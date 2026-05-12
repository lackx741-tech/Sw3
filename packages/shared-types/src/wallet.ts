/**
 * Wallet-related types for the Sw3 platform.
 *
 * Covers wallet connector types, connection state, and the unified
 * `ConnectedWallet` descriptor used throughout the SDK and UI.
 */

import type { ChainId } from "./chain.js";

// ─── Wallet connector types ───────────────────────────────────────────────────

/**
 * Wallet connector types supported by the Sw3 SDK.
 * Maps to the underlying wagmi / viem connector implementations.
 */
export enum WalletType {
  /** Browser-injected MetaMask wallet. */
  MetaMask = "METAMASK",
  /** WalletConnect v2 QR-code / deep-link wallet. */
  WalletConnect = "WALLETCONNECT",
  /** Coinbase Wallet (smart wallet or mobile app). */
  CoinbaseWallet = "COINBASE_WALLET",
  /** Any other EIP-1193 injected provider. */
  Injected = "INJECTED",
  /** Read-only / watch mode (no signing capability). */
  ReadOnly = "READ_ONLY",
}

// ─── Connection state ─────────────────────────────────────────────────────────

/** Possible connection lifecycle states for a wallet. */
export type WalletState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/**
 * Snapshot of a wallet connection attempt.
 * Emitted by the `WalletConnector` during and after the connection flow.
 */
export interface WalletConnection {
  type: WalletType;
  state: WalletState;
  /** EVM chain the wallet is currently on. */
  chainId: ChainId | null;
  /** Connected account address. */
  address: `0x${string}` | null;
  /** Human-readable error message when state === "error". */
  error: string | null;
  /** ISO-8601 timestamp of the last state transition. */
  updatedAt: string;
}

/**
 * A fully connected wallet descriptor, available once `state === "connected"`.
 * This is the type that most application code interacts with.
 */
export interface ConnectedWallet {
  type: WalletType;
  /** Currently active EVM chain. */
  chainId: ChainId;
  /** Primary connected address. */
  address: `0x${string}`;
  /**
   * All accounts exposed by the wallet, if the connector supports multi-account
   * (e.g. WalletConnect sessions with multiple addresses).
   */
  accounts: readonly `0x${string}`[];
  /**
   * Whether the wallet is capable of signing typed data (EIP-712).
   * Always `true` for MetaMask, CoinbaseWallet, and WalletConnect v2.
   * May be `false` for some hardware wallets or read-only connectors.
   */
  supportsEip712: boolean;
  /**
   * Whether the wallet supports EIP-1559 fee markets on the current chain.
   */
  supportsEip1559: boolean;
  /** ISO-8601 timestamp when this connection was established. */
  connectedAt: string;
}
