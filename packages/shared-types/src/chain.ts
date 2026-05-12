/**
 * Chain-related types and constants for the Sw3 platform.
 *
 * Defines all EVM chains supported by the sweeper contracts, along with
 * per-chain configuration (RPC URLs, block explorers, confirmation counts).
 */

// ─── Chain Identifiers ────────────────────────────────────────────────────────

/**
 * EVM chain IDs supported by the Sw3 sweeping platform.
 * Values match the canonical chain IDs registered in chainlist.org.
 */
export enum ChainId {
  Mainnet = 1,
  Goerli = 5,
  Sepolia = 11155111,
  Arbitrum = 42161,
  Optimism = 10,
  Polygon = 137,
  Base = 8453,
}

// ─── Chain Configuration ──────────────────────────────────────────────────────

/** Native (gas) currency descriptor for a chain. */
export interface NativeCurrency {
  /** Human-readable name, e.g. "Ether". */
  name: string;
  /** Ticker symbol, e.g. "ETH". */
  symbol: string;
  /** Always 18 for EVM-native currencies. */
  decimals: 18;
}

/**
 * Full configuration for a supported EVM chain.
 * Consumed by the SDK client and UI components.
 */
export interface ChainConfig {
  /** EVM chain ID. */
  id: ChainId;
  /** Human-readable network name. */
  name: string;
  /** Primary RPC URL (may be overridden by the SDK). */
  rpcUrl: string;
  /** Block explorer base URL (no trailing slash). */
  blockExplorer: string;
  /** Native currency metadata. */
  nativeCurrency: NativeCurrency;
  /**
   * Number of block confirmations the platform waits for before considering
   * a transaction finalised.
   */
  confirmations: number;
  /** Average block time in milliseconds, used for polling heuristics. */
  blockTimeMs: number;
  /** Whether this chain is a testnet (affects fee estimation warnings). */
  isTestnet: boolean;
}

// ─── Supported chains ─────────────────────────────────────────────────────────

/**
 * Read-only map of all chains the platform supports, keyed by {@link ChainId}.
 * Import this constant rather than hardcoding chain metadata throughout the
 * codebase.
 *
 * @example
 * ```ts
 * const cfg = SUPPORTED_CHAINS[ChainId.Mainnet];
 * console.log(cfg.name); // "Ethereum Mainnet"
 * ```
 */
export const SUPPORTED_CHAINS: Readonly<Record<ChainId, ChainConfig>> = {
  [ChainId.Mainnet]: {
    id: ChainId.Mainnet,
    name: "Ethereum Mainnet",
    rpcUrl: "https://eth.llamarpc.com",
    blockExplorer: "https://etherscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    confirmations: 2,
    blockTimeMs: 12_000,
    isTestnet: false,
  },
  [ChainId.Goerli]: {
    id: ChainId.Goerli,
    name: "Goerli Testnet",
    rpcUrl: "https://rpc.ankr.com/eth_goerli",
    blockExplorer: "https://goerli.etherscan.io",
    nativeCurrency: { name: "Goerli Ether", symbol: "ETH", decimals: 18 },
    confirmations: 1,
    blockTimeMs: 12_000,
    isTestnet: true,
  },
  [ChainId.Sepolia]: {
    id: ChainId.Sepolia,
    name: "Sepolia Testnet",
    rpcUrl: "https://rpc.sepolia.org",
    blockExplorer: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    confirmations: 1,
    blockTimeMs: 12_000,
    isTestnet: true,
  },
  [ChainId.Arbitrum]: {
    id: ChainId.Arbitrum,
    name: "Arbitrum One",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    confirmations: 1,
    blockTimeMs: 250,
    isTestnet: false,
  },
  [ChainId.Optimism]: {
    id: ChainId.Optimism,
    name: "OP Mainnet",
    rpcUrl: "https://mainnet.optimism.io",
    blockExplorer: "https://optimistic.etherscan.io",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    confirmations: 1,
    blockTimeMs: 2_000,
    isTestnet: false,
  },
  [ChainId.Polygon]: {
    id: ChainId.Polygon,
    name: "Polygon Mainnet",
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    confirmations: 5,
    blockTimeMs: 2_000,
    isTestnet: false,
  },
  [ChainId.Base]: {
    id: ChainId.Base,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    confirmations: 1,
    blockTimeMs: 2_000,
    isTestnet: false,
  },
} as const;

/** Convenience array of all supported chain IDs. */
export const SUPPORTED_CHAIN_IDS = Object.values(ChainId).filter(
  (v): v is ChainId => typeof v === "number",
);
