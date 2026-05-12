/**
 * Chain configurations for all chains supported by the Sw3 platform.
 *
 * Each entry extends the base {@link ChainConfig} type with:
 *  - multiple RPC fallback endpoints (tried in order)
 *  - expected block time for polling heuristics
 *  - the number of confirmations the platform requires before finalising
 */

import { ChainId, type ChainConfig } from "@sw3/shared-types";

// ─── Extended chain config ────────────────────────────────────────────────────

/** Chain config enriched with RPC fallback list and gas strategy. */
export interface ExtendedChainConfig extends ChainConfig {
  /**
   * Ordered list of RPC endpoints.  The SDK's `RpcProvider` tries them
   * left-to-right, falling back to the next on error or timeout.
   */
  rpcUrls: readonly string[];
  /**
   * Whether to use EIP-1559 fee model (`maxFeePerGas` + `maxPriorityFeePerGas`)
   * instead of legacy `gasPrice`.
   */
  supportsEip1559: boolean;
  /**
   * Multiplier applied to the estimated gas to add a safety margin.
   * E.g. 1.2 means "add 20 % buffer".
   */
  gasLimitMultiplier: number;
}

// ─── Chain definitions ────────────────────────────────────────────────────────

export const CHAIN_CONFIGS: Readonly<Record<ChainId, ExtendedChainConfig>> = {
  [ChainId.Mainnet]: {
    id: ChainId.Mainnet,
    name: "Ethereum Mainnet",
    rpcUrl: "https://eth.llamarpc.com",
    rpcUrls: [
      "https://eth.llamarpc.com",
      "https://rpc.ankr.com/eth",
      "https://cloudflare-eth.com",
      "https://ethereum.publicnode.com",
    ],
    blockExplorer: "https://etherscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    confirmations: 2,
    blockTimeMs: 12_000,
    isTestnet: false,
    supportsEip1559: true,
    gasLimitMultiplier: 1.2,
  },
  [ChainId.Goerli]: {
    id: ChainId.Goerli,
    name: "Goerli Testnet",
    rpcUrl: "https://rpc.ankr.com/eth_goerli",
    rpcUrls: [
      "https://rpc.ankr.com/eth_goerli",
      "https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    ],
    blockExplorer: "https://goerli.etherscan.io",
    nativeCurrency: { name: "Goerli Ether", symbol: "ETH", decimals: 18 },
    confirmations: 1,
    blockTimeMs: 12_000,
    isTestnet: true,
    supportsEip1559: true,
    gasLimitMultiplier: 1.3,
  },
  [ChainId.Sepolia]: {
    id: ChainId.Sepolia,
    name: "Sepolia Testnet",
    rpcUrl: "https://rpc.sepolia.org",
    rpcUrls: [
      "https://rpc.sepolia.org",
      "https://rpc.ankr.com/eth_sepolia",
      "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    ],
    blockExplorer: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    confirmations: 1,
    blockTimeMs: 12_000,
    isTestnet: true,
    supportsEip1559: true,
    gasLimitMultiplier: 1.3,
  },
  [ChainId.Arbitrum]: {
    id: ChainId.Arbitrum,
    name: "Arbitrum One",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    rpcUrls: [
      "https://arb1.arbitrum.io/rpc",
      "https://rpc.ankr.com/arbitrum",
      "https://arbitrum-one.publicnode.com",
    ],
    blockExplorer: "https://arbiscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    confirmations: 1,
    blockTimeMs: 250,
    isTestnet: false,
    supportsEip1559: true,
    gasLimitMultiplier: 1.15,
  },
  [ChainId.Optimism]: {
    id: ChainId.Optimism,
    name: "OP Mainnet",
    rpcUrl: "https://mainnet.optimism.io",
    rpcUrls: [
      "https://mainnet.optimism.io",
      "https://rpc.ankr.com/optimism",
      "https://optimism.publicnode.com",
    ],
    blockExplorer: "https://optimistic.etherscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    confirmations: 1,
    blockTimeMs: 2_000,
    isTestnet: false,
    supportsEip1559: true,
    gasLimitMultiplier: 1.15,
  },
  [ChainId.Polygon]: {
    id: ChainId.Polygon,
    name: "Polygon Mainnet",
    rpcUrl: "https://polygon-rpc.com",
    rpcUrls: [
      "https://polygon-rpc.com",
      "https://rpc.ankr.com/polygon",
      "https://polygon.publicnode.com",
    ],
    blockExplorer: "https://polygonscan.com",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    confirmations: 5,
    blockTimeMs: 2_000,
    isTestnet: false,
    supportsEip1559: true,
    gasLimitMultiplier: 1.2,
  },
  [ChainId.Base]: {
    id: ChainId.Base,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    rpcUrls: [
      "https://mainnet.base.org",
      "https://base.publicnode.com",
      "https://rpc.ankr.com/base",
    ],
    blockExplorer: "https://basescan.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    confirmations: 1,
    blockTimeMs: 2_000,
    isTestnet: false,
    supportsEip1559: true,
    gasLimitMultiplier: 1.15,
  },
} as const;

/**
 * Returns the {@link ExtendedChainConfig} for the given chain ID.
 *
 * @throws {Error} if the chain is not in {@link CHAIN_CONFIGS}.
 */
export function getChainConfig(chainId: ChainId): ExtendedChainConfig {
  const cfg = CHAIN_CONFIGS[chainId];
  if (!cfg) {
    throw new Error(
      `Chain ${chainId} is not supported. Supported chains: ${Object.keys(CHAIN_CONFIGS).join(", ")}`,
    );
  }
  return cfg;
}

/** Returns all mainnet (non-testnet) chain configs. */
export function getMainnetChains(): ExtendedChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((c) => !c.isTestnet);
}

/** Returns all testnet chain configs. */
export function getTestnetChains(): ExtendedChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter((c) => c.isTestnet);
}
