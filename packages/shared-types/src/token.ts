/**
 * Token-related types for the Sw3 platform.
 *
 * Covers on-chain token metadata, balances, pricing, and the minimal ERC-20 ABI
 * needed by the sweeper SDK for allowance/transfer calls.
 */

import type { ChainId } from "./chain.js";

// ─── Core token types ─────────────────────────────────────────────────────────

/**
 * Minimal on-chain ERC-20 token descriptor.
 * All values are sourced from on-chain storage or a trusted token registry.
 */
export interface Token {
  /** EVM chain the token lives on. */
  chainId: ChainId;
  /** Checksummed ERC-20 contract address. */
  address: `0x${string}`;
  /** Token name as returned by `name()`. */
  name: string;
  /** Ticker symbol as returned by `symbol()`. */
  symbol: string;
  /** Decimal precision as returned by `decimals()`. */
  decimals: number;
  /** Optional URI for the token logo image. */
  logoUri?: string;
}

/**
 * Token enriched with the holder's current on-chain balance.
 * All numeric values are stored as `bigint` to avoid precision loss.
 */
export interface TokenWithBalance extends Token {
  /** Raw balance in the token's smallest unit (wei-equivalent). */
  balance: bigint;
  /** Human-readable formatted balance (e.g. "1.234"). */
  formattedBalance: string;
  /** USD value of the balance, or `null` if price is unavailable. */
  usdValue: string | null;
}

/**
 * Extended token metadata sourced from an off-chain registry or indexer.
 */
export interface TokenMetadata extends Token {
  /** CoinGecko or similar registry ID for price lookups. */
  coingeckoId?: string;
  /** Token website. */
  website?: string;
  /** Short description of the token project. */
  description?: string;
  /** Social links (twitter, discord, etc.). */
  social?: Record<string, string>;
  /** Whether the token has been verified by the platform. */
  isVerified: boolean;
  /** Whether the token is on the platform's deny-list. */
  isBlocked: boolean;
  /** Tags such as "stablecoin", "governance", "lp-token". */
  tags: string[];
}

/**
 * Current price data for a token.
 */
export interface TokenPrice {
  /** Checksummed ERC-20 contract address. */
  address: `0x${string}`;
  chainId: ChainId;
  /** Price in USD as a decimal string to avoid floating-point issues. */
  priceUsd: string;
  /** 24-hour price change in percent, e.g. "3.14" or "-1.50". */
  change24hPct: string | null;
  /** Unix timestamp (seconds) of when the price was fetched. */
  fetchedAt: number;
}

// ─── Minimal ERC-20 ABI ───────────────────────────────────────────────────────

/**
 * Minimal ERC-20 ABI covering the subset of functions used by the sweeper
 * contracts and SDK.  Use this instead of a full ABI to keep bundle size small.
 *
 * @example
 * ```ts
 * import { createPublicClient } from "viem";
 * const balance = await client.readContract({
 *   abi: ERC20ABI,
 *   address,
 *   functionName: "balanceOf",
 *   args: [holder],
 * });
 * ```
 */
export const ERC20ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;
