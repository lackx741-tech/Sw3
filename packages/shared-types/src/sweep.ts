/**
 * Sweep-related types for the Sw3 ERC-20 sweeping platform.
 *
 * A "sweep" is the act of moving ERC-20 tokens from one or more source wallets
 * into a designated destination wallet, optionally using Permit2 signatures to
 * avoid a separate approve transaction.
 */

import type { ChainId } from "./chain.js";
import type { Token } from "./token.js";

// ─── Status ───────────────────────────────────────────────────────────────────

/** Lifecycle states of a sweep operation. */
export enum SweepStatus {
  /** The sweep has been created but not yet submitted to the network. */
  Pending = "PENDING",
  /** The sweep transaction has been broadcast and is awaiting confirmation. */
  Submitted = "SUBMITTED",
  /** At least one block has confirmed the sweep transaction. */
  Confirmed = "CONFIRMED",
  /** The sweep has reached the required number of confirmations. */
  Finalised = "FINALISED",
  /** The sweep transaction reverted on-chain. */
  Failed = "FAILED",
  /** The sweep was cancelled before submission. */
  Cancelled = "CANCELLED",
}

// ─── Sweep legs ───────────────────────────────────────────────────────────────

/**
 * A single ERC-20 transfer leg within a batch sweep.
 * Requires a prior `approve()` or Permit2 allowance.
 */
export interface SweepLeg {
  /** Token to sweep. */
  token: Token;
  /** Source wallet address. */
  from: `0x${string}`;
  /** Destination wallet address. */
  to: `0x${string}`;
  /** Raw token amount to sweep (in the token's smallest unit). */
  amount: bigint;
  /** Platform fee in basis points (0–1000). */
  feeBps: number;
  /** Computed fee amount in the same token units. */
  feeAmount: bigint;
  /** Net amount after fee deduction. */
  netAmount: bigint;
}

/**
 * A sweep leg that uses a Permit2 signature instead of a separate approval.
 * The signature authorises both the fee deduction and the recipient transfer
 * in a single on-chain call.
 */
export interface PermitSweepLeg extends SweepLeg {
  /** EIP-712 permit signature (65-byte hex). */
  signature: `0x${string}`;
  /** Permit nonce used for the signature. */
  nonce: bigint;
  /** Unix timestamp (seconds) after which the permit is invalid. */
  deadline: bigint;
}

// ─── Batch & request ─────────────────────────────────────────────────────────

/**
 * A batch of sweep legs to be executed in a single contract call.
 * All legs must belong to the same chain.
 */
export interface SweepBatch {
  /** Unique batch identifier (UUID). */
  id: string;
  chainId: ChainId;
  /** Individual transfer legs. */
  legs: Array<SweepLeg | PermitSweepLeg>;
  /** Combined gas estimate for the entire batch. */
  estimatedGas: bigint;
  /** ABI-encoded calldata for the sweeper contract's `sweep()` function. */
  calldata: `0x${string}`;
  /** Unix timestamp (seconds) after which the batch cannot be submitted. */
  deadline: number;
  /** Creation timestamp (ISO-8601 string). */
  createdAt: string;
}

/** API request payload for creating a new sweep job. */
export interface SweepRequest {
  chainId: ChainId;
  /** Ordered list of legs. At most {@link SweepConfig.maxBatchSize} entries. */
  legs: Array<Omit<SweepLeg, "feeAmount" | "netAmount">>;
  /** Whether to use Permit2 for all applicable legs. */
  usePermit2: boolean;
  /** Caller-supplied deadline override (seconds from now). */
  deadlineSeconds?: number;
  /** Arbitrary key-value metadata stored with the sweep job. */
  metadata?: Record<string, string>;
}

/** Outcome returned after a sweep has been executed on-chain. */
export interface SweepResult {
  /** Sweep job ID. */
  id: string;
  status: SweepStatus;
  /** Transaction hash, set once submitted. */
  txHash: `0x${string}` | null;
  /** Block number in which the transaction was included. */
  blockNumber: bigint | null;
  /** Total gas consumed. */
  gasUsed: bigint | null;
  /** Effective gas price in wei. */
  gasPrice: bigint | null;
  /** Wall-clock timestamp (ISO-8601) when the sweep was finalised. */
  finalisedAt: string | null;
  /** Human-readable failure reason, set when status is Failed. */
  error: string | null;
}

// ─── Platform configuration ───────────────────────────────────────────────────

/** Runtime configuration values for the sweeper platform. */
export interface SweepConfig {
  /** Maximum number of legs in a single batch. */
  maxBatchSize: number;
  /** Maximum fee in basis points the platform will accept. */
  maxFeeBps: number;
  /** Default deadline for new batches, in seconds from creation time. */
  defaultDeadlineSeconds: number;
  /** Permit2 contract address (same on all chains). */
  permit2Address: `0x${string}`;
  /** Address that receives platform fees. */
  feeRecipient: `0x${string}`;
}
