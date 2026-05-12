/**
 * Permit2 type definitions for the Sw3 platform.
 *
 * These types mirror the Uniswap Permit2 on-chain structures used for
 * EIP-712 `signTypedData` calls.  The SDK's `PermitSigner` uses these types
 * to build and verify permit signatures without pulling in the entire
 * @uniswap/permit2-sdk package.
 *
 * @see https://github.com/Uniswap/permit2
 */

// ─── Token permissions ────────────────────────────────────────────────────────

/**
 * Specifies the token and maximum amount that a spender is permitted to
 * transfer via `SignatureTransfer`.
 */
export interface TokenPermissions {
  /** ERC-20 token contract address. */
  token: `0x${string}`;
  /** Maximum amount the spender may transfer. */
  amount: bigint;
}

// ─── AllowanceTransfer ────────────────────────────────────────────────────────

/**
 * Details for an `AllowanceTransfer` permit.
 * Grants a spender an allowance up to `amount` that expires at `expiration`.
 */
export interface PermitDetails {
  /** ERC-20 token contract address. */
  token: `0x${string}`;
  /**
   * Maximum amount the spender may transfer via `AllowanceTransfer`.
   * Use `type(uint160).max` for an unlimited allowance.
   */
  amount: bigint;
  /**
   * Unix timestamp (seconds) after which the allowance is no longer valid.
   * Use `type(uint48).max` for a non-expiring allowance.
   */
  expiration: number;
  /** Nonce used to prevent signature replay. */
  nonce: number;
}

/**
 * Single-token `AllowanceTransfer` permit.
 * Used when a wallet approves one token for one spender in one signature.
 */
export interface PermitSingle {
  details: PermitDetails;
  /** The address of the spender (e.g. the sweeper contract). */
  spender: `0x${string}`;
  /** Unix timestamp (seconds) after which the permit signature itself expires. */
  sigDeadline: bigint;
}

/**
 * Multi-token `AllowanceTransfer` permit.
 * Allows approving multiple tokens for the same spender in one signature.
 */
export interface PermitBatch {
  details: PermitDetails[];
  spender: `0x${string}`;
  sigDeadline: bigint;
}

// ─── SignatureTransfer ────────────────────────────────────────────────────────

/**
 * Details for a `SignatureTransfer` permit.
 * Grants a one-time transfer (no stored allowance) up to `amount`.
 */
export interface AllowanceTransferDetails {
  /** ERC-20 token contract address. */
  token: `0x${string}`;
  /** Transfer recipient. */
  to: `0x${string}`;
  /** Amount to transfer (must be ≤ the permitted amount). */
  requestedAmount: bigint;
  /** Owner of the tokens (i.e. the signing wallet). */
  from: `0x${string}`;
}

/**
 * Permit for a single-use `SignatureTransfer`.
 * The permit is consumed on first use and cannot be replayed.
 */
export interface PermitTransferFrom {
  permitted: TokenPermissions;
  /** Address of the spender contract. Must match the recovering contract. */
  spender: `0x${string}`;
  /** Unique nonce preventing replay. Typically derived from `block.timestamp`. */
  nonce: bigint;
  /** Unix timestamp (seconds) after which the permit expires. */
  deadline: bigint;
}

// ─── EIP-712 typed-data helpers ───────────────────────────────────────────────

/**
 * EIP-712 domain for the Permit2 contract.
 * The `verifyingContract` field must be the deployed Permit2 address on the
 * target chain.
 */
export interface Permit2Domain {
  name: "Permit2";
  chainId: number;
  verifyingContract: `0x${string}`;
}

/** EIP-712 type definitions for `PermitSingle`. */
export const PERMIT_SINGLE_TYPES = {
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
} as const;

/** EIP-712 type definitions for `PermitBatch`. */
export const PERMIT_BATCH_TYPES = {
  PermitBatch: [
    { name: "details", type: "PermitDetails[]" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
} as const;

/** EIP-712 type definitions for `PermitTransferFrom`. */
export const PERMIT_TRANSFER_FROM_TYPES = {
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
} as const;
