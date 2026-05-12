/**
 * SweeperClient — the primary entry point for the Sw3 SDK.
 *
 * Instantiate once per application and pass it down via context or dependency
 * injection.  All sub-modules (executor, wallet connector, analytics, etc.)
 * accept a client instance rather than building their own viem clients.
 *
 * @example
 * ```ts
 * import { SweeperClient } from "@sw3/sdk";
 * import { ChainId } from "@sw3/shared-types";
 *
 * const client = new SweeperClient({
 *   chainId: ChainId.Mainnet,
 *   rpcUrls: ["https://eth.llamarpc.com"],
 *   apiUrl: "https://api.sw3.io",
 *   apiKey: process.env.SW3_API_KEY,
 * });
 *
 * client.on("sweepCompleted", (result) => console.log(result.txHash));
 * ```
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import {
  CHAIN_CONFIGS,
  CONTRACT_ADDRESSES,
  type ExtendedChainConfig,
} from "@sw3/config";
import type { ChainId, ConnectedWallet } from "@sw3/shared-types";
import type { ContractAddresses } from "@sw3/config";
import {
  SdkErrorCode,
  ValidationError,
  WalletError,
} from "./errors.js";
import {
  SweeperEventEmitter,
  type SweeperEventMap,
  type SweeperEventName,
  type SweeperListener,
} from "./events.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface SweeperClientConfig {
  /** EVM chain the client will operate on. */
  chainId: ChainId;
  /**
   * Ordered list of JSON-RPC endpoints.  The SDK tries them left-to-right,
   * falling back on errors.
   */
  rpcUrls?: string[];
  /**
   * Override specific contract addresses (e.g. when using a local testnet
   * fork with freshly-deployed contracts).
   */
  contractAddresses?: Partial<ContractAddresses>;
  /** Sw3 REST API base URL (without trailing slash). */
  apiUrl?: string;
  /** API key for authenticated endpoints. */
  apiKey?: string;
  /**
   * Optional window / global provider to use for the wallet client.
   * If omitted, the wallet client can only be created after connecting a wallet.
   */
  provider?: { request: (...args: unknown[]) => Promise<unknown> };
  /** Whether to print verbose SDK logs to the console. Defaults to `false`. */
  debug?: boolean;
}

// ─── Client ───────────────────────────────────────────────────────────────────

/** Viem chain descriptor built from our {@link ExtendedChainConfig}. */
function toViemChain(cfg: ExtendedChainConfig) {
  return {
    id: cfg.id,
    name: cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    rpcUrls: {
      default: { http: cfg.rpcUrls as unknown as readonly [string, ...string[]] },
      public: { http: cfg.rpcUrls as unknown as readonly [string, ...string[]] },
    },
    blockExplorers: {
      default: { name: cfg.name, url: cfg.blockExplorer },
    },
  } as const;
}

/**
 * Core SDK client.
 *
 * Manages viem public/wallet clients, contract addresses, and the platform
 * event bus.  All other SDK modules accept this class as a dependency.
 */
export class SweeperClient {
  readonly config: Required<
    Omit<SweeperClientConfig, "provider" | "contractAddresses">
  > & {
    provider?: SweeperClientConfig["provider"];
    contractAddresses: ContractAddresses;
  };

  private readonly emitter = new SweeperEventEmitter();
  private _publicClient: PublicClient | null = null;
  private _walletClient: WalletClient | null = null;
  private _connectedWallet: ConnectedWallet | null = null;

  constructor(config: SweeperClientConfig) {
    const chainCfg = CHAIN_CONFIGS[config.chainId];
    if (!chainCfg) {
      throw new ValidationError(
        `Chain ${config.chainId} is not supported`,
        SdkErrorCode.ChainNotSupported,
        { context: { chainId: config.chainId } },
      );
    }

    const baseAddresses = CONTRACT_ADDRESSES[config.chainId];

    this.config = {
      chainId: config.chainId,
      rpcUrls:
        config.rpcUrls && config.rpcUrls.length > 0
          ? config.rpcUrls
          : [...chainCfg.rpcUrls],
      contractAddresses: { ...baseAddresses, ...config.contractAddresses },
      apiUrl: config.apiUrl ?? "https://api.sw3.io",
      apiKey: config.apiKey ?? "",
      provider: config.provider,
      debug: config.debug ?? false,
    };
  }

  // ─── viem clients ──────────────────────────────────────────────────────────

  /**
   * Returns (and lazily creates) a viem `PublicClient` for the configured chain.
   * The client uses the first RPC URL in `config.rpcUrls`; use `RpcProvider`
   * for automatic failover across the full list.
   */
  getPublicClient(): PublicClient {
    if (!this._publicClient) {
      const chainCfg = CHAIN_CONFIGS[this.config.chainId]!;
      const viemChain = toViemChain(chainCfg);
      this._publicClient = createPublicClient({
        chain: viemChain,
        transport: http(this.config.rpcUrls[0]),
      });
    }
    return this._publicClient;
  }

  /**
   * Returns a viem `WalletClient` backed by the connected provider.
   *
   * @throws {WalletError} if no provider is available (wallet not connected).
   */
  getWalletClient(): WalletClient {
    if (!this._walletClient) {
      if (!this.config.provider) {
        throw new WalletError(
          "No wallet provider available — connect a wallet first",
          SdkErrorCode.WalletNotConnected,
        );
      }
      const chainCfg = CHAIN_CONFIGS[this.config.chainId]!;
      const viemChain = toViemChain(chainCfg);
      this._walletClient = createWalletClient({
        chain: viemChain,
        transport: custom(this.config.provider),
      });
    }
    return this._walletClient;
  }

  /** Replaces the internal provider (called by `WalletConnector` on connect). */
  setProvider(
    provider: { request: (...args: unknown[]) => Promise<unknown> },
  ): void {
    (this.config as { provider?: typeof provider }).provider = provider;
    this._walletClient = null; // invalidate cached wallet client
  }

  /** Clears the wallet client and provider (called on disconnect). */
  clearProvider(): void {
    (this.config as { provider?: unknown }).provider = undefined;
    this._walletClient = null;
    this._connectedWallet = null;
  }

  // ─── Chain config ──────────────────────────────────────────────────────────

  /** Returns the {@link ExtendedChainConfig} for the client's configured chain. */
  getChainConfig(): ExtendedChainConfig {
    return CHAIN_CONFIGS[this.config.chainId]!;
  }

  // ─── Connected wallet ──────────────────────────────────────────────────────

  /** Returns the currently connected wallet, or `null` if not connected. */
  getConnectedWallet(): ConnectedWallet | null {
    return this._connectedWallet;
  }

  /** Updates the connected wallet descriptor. Called by `WalletConnector`. */
  setConnectedWallet(wallet: ConnectedWallet | null): void {
    this._connectedWallet = wallet;
  }

  // ─── Event bus ─────────────────────────────────────────────────────────────

  on<K extends SweeperEventName>(
    event: K,
    listener: SweeperListener<K>,
  ): this {
    this.emitter.on(event, listener);
    return this;
  }

  off<K extends SweeperEventName>(
    event: K,
    listener: SweeperListener<K>,
  ): this {
    this.emitter.off(event, listener);
    return this;
  }

  once<K extends SweeperEventName>(
    event: K,
    listener: SweeperListener<K>,
  ): this {
    this.emitter.once(event, listener);
    return this;
  }

  emit<K extends SweeperEventName>(
    event: K,
    payload: SweeperEventMap[K],
  ): boolean {
    if (this.config.debug) {
      console.debug(`[SweeperClient] emit ${event}`, payload);
    }
    return this.emitter.emit(event, payload);
  }

  // ─── Misc ──────────────────────────────────────────────────────────────────

  /** Debug-mode log helper. No-ops when `config.debug === false`. */
  log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.debug(`[SweeperClient] ${message}`, ...args);
    }
  }
}
