/**
 * WalletConnector — manages wallet connections via wagmi-compatible connectors.
 *
 * Supports MetaMask (injected), WalletConnect v2, and Coinbase Wallet.
 * The connector updates the parent {@link SweeperClient} with the provider
 * and emits lifecycle events via the client's event bus.
 *
 * @example
 * ```ts
 * const connector = new WalletConnector(client, {
 *   walletConnectProjectId: "abc123",
 * });
 *
 * const wallet = await connector.connect(WalletType.MetaMask);
 * await connector.switchChain(ChainId.Arbitrum);
 * await connector.disconnect();
 * ```
 */

import {
  ChainId,
  WalletType,
  type ConnectedWallet,
  type WalletConnection,
} from "@sw3/shared-types";
import { SdkErrorCode, WalletError, errOpts } from "../core/errors.js";
import type { SweeperClient } from "../core/client.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface WalletConnectorConfig {
  /**
   * WalletConnect v2 project ID (required when using WalletConnect).
   * Obtain from https://cloud.walletconnect.com
   */
  walletConnectProjectId?: string;
  /** Coinbase Wallet app name shown in the wallet UI. */
  coinbaseWalletAppName?: string;
}

// ─── EIP-1193 provider interface ──────────────────────────────────────────────

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
}

// ─── Connector ────────────────────────────────────────────────────────────────

export class WalletConnector {
  private readonly client: SweeperClient;
  private readonly config: WalletConnectorConfig;
  private provider: Eip1193Provider | null = null;

  constructor(client: SweeperClient, config: WalletConnectorConfig = {}) {
    this.client = client;
    this.config = config;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Connects to the specified wallet type.
   *
   * @returns The connected wallet descriptor.
   * @throws {WalletError} if the connection fails or the user rejects it.
   */
  async connect(type: WalletType): Promise<ConnectedWallet> {
    this.emitConnectionState({ type, state: "connecting" });

    try {
      const provider = await this.getProvider(type);
      this.provider = provider;

      // Request account access
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as `0x${string}`[];

      if (!accounts || accounts.length === 0) {
        throw new WalletError(
          "No accounts returned by wallet",
          SdkErrorCode.WalletRejected,
        );
      }

      const chainIdHex = (await provider.request({
        method: "eth_chainId",
      })) as string;
      const chainId = parseInt(chainIdHex, 16) as ChainId;

      // Register event listeners
      provider.on("accountsChanged", this.handleAccountsChanged);
      provider.on("chainChanged", this.handleChainChanged);
      provider.on("disconnect", this.handleDisconnect);

      // Update the client's provider
      this.client.setProvider({
        request: (...args: unknown[]) =>
          provider.request(args[0] as { method: string; params?: unknown[] }),
      });

      const wallet: ConnectedWallet = {
        type,
        chainId,
        address: accounts[0]!,
        accounts,
        supportsEip712: type !== WalletType.ReadOnly,
        supportsEip1559: true,
        connectedAt: new Date().toISOString(),
      };

      this.client.setConnectedWallet(wallet);
      this.client.emit("walletConnected", wallet);
      this.emitConnectionState({
        type,
        state: "connected",
        chainId,
        address: wallet.address,
      });

      return wallet;
    } catch (err: unknown) {
      this.emitConnectionState({ type, state: "error", error: String(err) });

      if (err instanceof WalletError) throw err;

      const msg = err instanceof Error ? err.message : String(err);
      const isRejection =
        msg.toLowerCase().includes("user rejected") ||
        msg.toLowerCase().includes("user denied") ||
        (err as { code?: number }).code === 4001;

      throw new WalletError(
        isRejection ? "User rejected the connection request" : msg,
        isRejection ? SdkErrorCode.WalletRejected : SdkErrorCode.WalletNotConnected,
        errOpts(err),
      );
    }
  }

  /**
   * Disconnects the current wallet and cleans up listeners.
   */
  async disconnect(): Promise<void> {
    const wallet = this.client.getConnectedWallet();

    if (this.provider) {
      this.provider.removeListener(
        "accountsChanged",
        this.handleAccountsChanged,
      );
      this.provider.removeListener("chainChanged", this.handleChainChanged);
      this.provider.removeListener("disconnect", this.handleDisconnect);
    }

    this.provider = null;
    this.client.clearProvider();

    if (wallet) {
      this.client.emit("walletDisconnected", { address: wallet.address });
    }

    this.emitConnectionState({ type: WalletType.Injected, state: "disconnected" });
  }

  /**
   * Requests the wallet to switch to a different EVM chain.
   *
   * @throws {WalletError} if the switch fails or the user rejects it.
   */
  async switchChain(targetChainId: ChainId): Promise<void> {
    if (!this.provider) {
      throw new WalletError(
        "No wallet connected",
        SdkErrorCode.WalletNotConnected,
      );
    }

    const currentWallet = this.client.getConnectedWallet();
    const fromChainId = currentWallet?.chainId ?? 0;

    try {
      await this.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (err: unknown) {
      // Error code 4902: chain not yet added to wallet — attempt to add it
      if ((err as { code?: number }).code === 4902) {
        await this.addChainToWallet(targetChainId);
        return;
      }
      throw new WalletError(
        `Failed to switch to chain ${targetChainId}`,
        SdkErrorCode.ChainSwitchFailed,
        errOpts(err, { targetChainId }),
      );
    }

    this.client.emit("chainChanged", { from: fromChainId, to: targetChainId });
  }

  /**
   * Returns the primary connected address, or `null` if not connected.
   */
  async getAddress(): Promise<`0x${string}` | null> {
    if (!this.provider) return null;
    try {
      const accounts = (await this.provider.request({
        method: "eth_accounts",
      })) as `0x${string}`[];
      return accounts[0] ?? null;
    } catch {
      return null;
    }
  }

  // ─── Provider resolution ───────────────────────────────────────────────────

  private async getProvider(type: WalletType): Promise<Eip1193Provider> {
    switch (type) {
      case WalletType.MetaMask:
      case WalletType.Injected: {
        const win = typeof window !== "undefined" ? window : null;
        const ethereum = (win as unknown as { ethereum?: Eip1193Provider })
          ?.ethereum;
        if (!ethereum) {
          throw new WalletError(
            "No injected wallet found. Please install MetaMask.",
            SdkErrorCode.WalletNotConnected,
          );
        }
        return ethereum;
      }

      case WalletType.WalletConnect: {
        if (!this.config.walletConnectProjectId) {
          throw new WalletError(
            "WalletConnect project ID is required",
            SdkErrorCode.WalletNotConnected,
          );
        }
        // Dynamic import to keep WalletConnect out of the main bundle for
        // users who don't need it.
        const { EthereumProvider } = await import(
          "@walletconnect/ethereum-provider"
        );
        const wcProvider = await EthereumProvider.init({
          projectId: this.config.walletConnectProjectId,
          chains: [this.client.config.chainId],
          showQrModal: true,
        });
        await wcProvider.connect();
        return wcProvider as unknown as Eip1193Provider;
      }

      case WalletType.CoinbaseWallet: {
        const { CoinbaseWalletSDK } = await import("@coinbase/wallet-sdk");
        const sdk = new CoinbaseWalletSDK({
          appName: this.config.coinbaseWalletAppName ?? "Sw3",
        });
        return sdk.makeWeb3Provider() as unknown as Eip1193Provider;
      }

      default:
        throw new WalletError(
          `Unsupported wallet type: ${String(type)}`,
          SdkErrorCode.WalletNotConnected,
        );
    }
  }

  private async addChainToWallet(chainId: ChainId): Promise<void> {
    const { CHAIN_CONFIGS } = await import("@sw3/config");
    const cfg = CHAIN_CONFIGS[chainId];
    if (!cfg || !this.provider) return;

    await this.provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: `0x${chainId.toString(16)}`,
          chainName: cfg.name,
          nativeCurrency: cfg.nativeCurrency,
          rpcUrls: cfg.rpcUrls,
          blockExplorerUrls: [cfg.blockExplorer],
        },
      ],
    });
  }

  // ─── Event handlers ────────────────────────────────────────────────────────

  private readonly handleAccountsChanged = (accounts: unknown): void => {
    const accs = accounts as `0x${string}`[];
    if (accs.length === 0) {
      void this.disconnect();
    } else {
      const wallet = this.client.getConnectedWallet();
      if (wallet) {
        const updated: ConnectedWallet = {
          ...wallet,
          address: accs[0]!,
          accounts: accs,
        };
        this.client.setConnectedWallet(updated);
        this.client.emit("walletConnected", updated);
      }
    }
  };

  private readonly handleChainChanged = (chainIdHex: unknown): void => {
    const wallet = this.client.getConnectedWallet();
    const newChainId = parseInt(chainIdHex as string, 16) as ChainId;
    if (wallet) {
      this.client.emit("chainChanged", {
        from: wallet.chainId,
        to: newChainId,
      });
    }
  };

  private readonly handleDisconnect = (): void => {
    void this.disconnect();
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private emitConnectionState(
    partial: Partial<WalletConnection> & { type: WalletType; state: WalletConnection["state"] },
  ): void {
    this.client.log("walletConnection", partial);
  }
}
