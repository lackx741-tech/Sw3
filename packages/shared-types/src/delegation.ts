/**
 * EIP-7702-style delegated execution types for the Sw3 platform.
 *
 * These types mirror the on-chain `DelegatedExecutor` contract structures and
 * the EIP-712 typed-data used to sign authorizations off-chain.
 *
 * @see contracts/eip7702/src/interfaces/IDelegatedExecutor.sol
 */

import type { ChainId } from "./chain.js";

// ─── On-chain primitives ──────────────────────────────────────────────────────

/**
 * A single low-level call within a delegated batch.
 * Mirrors the `IDelegatedExecutor.Call` Solidity struct.
 */
export interface DelegatedCall {
  /** Target contract or EOA address. */
  target: `0x${string}`;
  /** Native ETH (wei) to forward. Use `0n` for token-only calls. */
  value: bigint;
  /** ABI-encoded calldata. */
  data: `0x${string}`;
}

/**
 * The signed authorization payload submitted to `DelegatedExecutor.executeDelegated`.
 * Mirrors the `IDelegatedExecutor.Authorization` Solidity struct.
 */
export interface DelegationAuthorization {
  /** EOA that signs and authorises this batch. */
  signer: `0x${string}`;
  /**
   * Per-signer nonce for replay protection.
   * Each nonce value may only be used once per signer.
   */
  nonce: bigint;
  /** Unix timestamp (seconds) after which the authorization is invalid. */
  deadline: bigint;
  /** Ordered list of calls to execute on behalf of `signer`. */
  calls: DelegatedCall[];
}

// ─── SDK types ────────────────────────────────────────────────────────────────

/**
 * A complete delegated batch ready to be submitted via
 * `DelegatedExecutorClient.execute`.
 */
export interface DelegatedBatch {
  /** UUID identifying this batch instance. */
  id: string;
  chainId: ChainId;
  /** The signed authorization. */
  authorization: DelegationAuthorization;
  /** 65-byte ECDSA signature from `authorization.signer`. */
  signature: `0x${string}`;
  /** Combined gas estimate for the entire batch call. */
  estimatedGas: bigint;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

/** Result returned after a delegated batch has been executed on-chain. */
export interface DelegatedBatchResult {
  /** Batch UUID. */
  id: string;
  /** Whether the on-chain transaction succeeded. */
  success: boolean;
  /** Transaction hash once submitted. */
  txHash: `0x${string}` | null;
  /** Block number in which the transaction was included. */
  blockNumber: bigint | null;
  /** Total gas consumed. */
  gasUsed: bigint | null;
  /** Wall-clock timestamp (ISO-8601) when the batch was finalised. */
  finalisedAt: string | null;
  /** Human-readable failure reason when `success` is false. */
  error: string | null;
}

// ─── EIP-712 typed-data ───────────────────────────────────────────────────────

/**
 * EIP-712 domain for the `DelegatedExecutor` contract.
 * The `name` and `version` must match the constructor arguments in the contract.
 */
export interface DelegatedExecutorDomain {
  name: "DelegatedExecutor";
  version: "1";
  chainId: number;
  verifyingContract: `0x${string}`;
}

/** EIP-712 type definitions for `DelegatedCall`. */
export const DELEGATED_CALL_TYPES = {
  Call: [
    { name: "target", type: "address" },
    { name: "value",  type: "uint256" },
    { name: "data",   type: "bytes"   },
  ],
} as const;

/**
 * EIP-712 type definitions for `Authorization`.
 *
 * NOTE: The `calls` array is hashed as an array of `Call` structs, so the
 * type string includes `Call(address target,uint256 value,bytes data)` as a
 * referenced type.
 */
export const AUTHORIZATION_TYPES = {
  Authorization: [
    { name: "signer",   type: "address"  },
    { name: "nonce",    type: "uint256"  },
    { name: "deadline", type: "uint256"  },
    { name: "calls",    type: "Call[]"   },
  ],
  Call: [
    { name: "target", type: "address" },
    { name: "value",  type: "uint256" },
    { name: "data",   type: "bytes"   },
  ],
} as const;
