/**
 * Structured error hierarchy for the Sw3 SDK.
 *
 * All SDK errors extend {@link SweeperError} so consumers can catch them
 * with a single `instanceof SweeperError` check while still being able to
 * discriminate on `code` for fine-grained handling.
 */

// ─── Error codes ──────────────────────────────────────────────────────────────

export enum SdkErrorCode {
  // Generic
  Unknown = "SDK_UNKNOWN",
  InvalidArgument = "SDK_INVALID_ARGUMENT",

  // Network / RPC
  NetworkError = "SDK_NETWORK_ERROR",
  RpcTimeout = "SDK_RPC_TIMEOUT",
  RpcRateLimit = "SDK_RPC_RATE_LIMIT",
  AllRpcsExhausted = "SDK_ALL_RPCS_EXHAUSTED",

  // Contract
  ContractCallFailed = "SDK_CONTRACT_CALL_FAILED",
  TransactionReverted = "SDK_TRANSACTION_REVERTED",
  SimulationFailed = "SDK_SIMULATION_FAILED",
  ContractNotDeployed = "SDK_CONTRACT_NOT_DEPLOYED",
  GasEstimationFailed = "SDK_GAS_ESTIMATION_FAILED",

  // Wallet
  WalletNotConnected = "SDK_WALLET_NOT_CONNECTED",
  WalletRejected = "SDK_WALLET_REJECTED",
  WrongChain = "SDK_WRONG_CHAIN",
  ChainSwitchFailed = "SDK_CHAIN_SWITCH_FAILED",
  SignatureFailed = "SDK_SIGNATURE_FAILED",

  // Auth
  Unauthorized = "SDK_UNAUTHORIZED",
  SessionExpired = "SDK_SESSION_EXPIRED",
  InvalidSignature = "SDK_INVALID_SIGNATURE",
  SiweVerificationFailed = "SDK_SIWE_VERIFICATION_FAILED",

  // Validation
  InvalidAddress = "SDK_INVALID_ADDRESS",
  InvalidAmount = "SDK_INVALID_AMOUNT",
  BatchTooLarge = "SDK_BATCH_TOO_LARGE",
  DeadlineExceeded = "SDK_DEADLINE_EXCEEDED",
  ChainNotSupported = "SDK_CHAIN_NOT_SUPPORTED",

  // Rate limiting
  RateLimitExceeded = "SDK_RATE_LIMIT_EXCEEDED",
}

// ─── Base error ───────────────────────────────────────────────────────────────

/**
 * Base class for all Sw3 SDK errors.
 *
 * @example
 * ```ts
 * try {
 *   await executor.execute(batch);
 * } catch (err) {
 *   if (err instanceof SweeperError) {
 *     console.error(err.code, err.message);
 *   }
 * }
 * ```
 */
export class SweeperError extends Error {
  readonly code: SdkErrorCode;
  /** Original error that caused this one, if any. */
  readonly cause: Error | undefined;
  /** Extra context attached at throw site. */
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: SdkErrorCode = SdkErrorCode.Unknown,
    options?: { cause?: Error; context?: Record<string, unknown> },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.cause = options?.cause;
    this.context = options?.context ?? {};
    // Maintain correct prototype chain in environments that transpile classes.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause?.message,
    };
  }
}

// ─── Sub-classes ──────────────────────────────────────────────────────────────

/** Thrown when an RPC request fails due to a network-level issue. */
export class NetworkError extends SweeperError {
  constructor(
    message: string,
    options?: { cause?: Error; context?: Record<string, unknown> },
  ) {
    super(message, SdkErrorCode.NetworkError, options);
  }
}

/** Thrown when all RPC fallback endpoints have been exhausted. */
export class AllRpcsExhaustedError extends SweeperError {
  constructor(
    triedUrls: string[],
    options?: { cause?: Error },
  ) {
    super(
      `All RPC endpoints exhausted: ${triedUrls.join(", ")}`,
      SdkErrorCode.AllRpcsExhausted,
      { ...options, context: { triedUrls } },
    );
  }
}

/** Thrown when an on-chain contract call or transaction fails. */
export class ContractError extends SweeperError {
  constructor(
    message: string,
    code:
      | SdkErrorCode.ContractCallFailed
      | SdkErrorCode.TransactionReverted
      | SdkErrorCode.SimulationFailed
      | SdkErrorCode.ContractNotDeployed
      | SdkErrorCode.GasEstimationFailed = SdkErrorCode.ContractCallFailed,
    options?: { cause?: Error; context?: Record<string, unknown> },
  ) {
    super(message, code, options);
  }
}

/** Thrown when a wallet action fails or is rejected by the user. */
export class WalletError extends SweeperError {
  constructor(
    message: string,
    code:
      | SdkErrorCode.WalletNotConnected
      | SdkErrorCode.WalletRejected
      | SdkErrorCode.WrongChain
      | SdkErrorCode.ChainSwitchFailed
      | SdkErrorCode.SignatureFailed = SdkErrorCode.WalletNotConnected,
    options?: { cause?: Error; context?: Record<string, unknown> },
  ) {
    super(message, code, options);
  }
}

/** Thrown when an authentication or session check fails. */
export class AuthError extends SweeperError {
  constructor(
    message: string,
    code:
      | SdkErrorCode.Unauthorized
      | SdkErrorCode.SessionExpired
      | SdkErrorCode.InvalidSignature
      | SdkErrorCode.SiweVerificationFailed = SdkErrorCode.Unauthorized,
    options?: { cause?: Error; context?: Record<string, unknown> },
  ) {
    super(message, code, options);
  }
}

/** Thrown when input validation fails. */
export class ValidationError extends SweeperError {
  /** Field path that failed, if applicable. */
  readonly field: string | undefined;

  constructor(
    message: string,
    code:
      | SdkErrorCode.InvalidArgument
      | SdkErrorCode.InvalidAddress
      | SdkErrorCode.InvalidAmount
      | SdkErrorCode.BatchTooLarge
      | SdkErrorCode.DeadlineExceeded
      | SdkErrorCode.ChainNotSupported = SdkErrorCode.InvalidArgument,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      field?: string;
    },
  ) {
    super(message, code, options);
    this.field = options?.field;
  }
}

/** Thrown when the API or RPC rate limit is exceeded. */
export class RateLimitError extends SweeperError {
  /** Number of seconds to wait before retrying (from Retry-After header). */
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      retryAfterSeconds?: number;
    },
  ) {
    super(message, SdkErrorCode.RateLimitExceeded, options);
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/**
 * Builds error constructor options, only including `cause` when `err` is a
 * real `Error` instance.  Required because `exactOptionalPropertyTypes` rejects
 * `{ cause: Error | undefined }` — the key must either be absent or be `Error`.
 *
 * @example
 * ```ts
 * throw new NetworkError("RPC failed", errOpts(err, { url }));
 * ```
 */
export function errOpts(
  err: unknown,
  context?: Record<string, unknown>,
): { cause?: Error; context?: Record<string, unknown> } {
  return {
    ...(err instanceof Error ? { cause: err } : {}),
    ...(context !== undefined ? { context } : {}),
  };
}
