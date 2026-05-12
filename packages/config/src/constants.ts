/**
 * Platform-wide constants for the Sw3 sweeping platform.
 *
 * These values are used across the SDK, API, and smart contracts to enforce
 * consistent limits, defaults, and well-known addresses.
 */

// ─── Batch limits ─────────────────────────────────────────────────────────────

/** Maximum number of sweep legs allowed in a single batch call. */
export const MAX_BATCH_SIZE = 100;

/** Maximum number of tokens that can be covered by one Permit2 batch permit. */
export const MAX_PERMIT_BATCH_SIZE = 50;

// ─── Fee limits ───────────────────────────────────────────────────────────────

/** Denominator for basis-point calculations (1 bps = 0.01 %). */
export const BPS_DENOMINATOR = 10_000;

/** Maximum platform fee in basis points (1000 bps = 10 %). */
export const MAX_FEE_BPS = 1_000;

/** Default platform fee in basis points (30 bps = 0.3 %). */
export const DEFAULT_FEE_BPS = 30;

// ─── Timing ───────────────────────────────────────────────────────────────────

/** Default deadline for new sweep batches, in seconds from the time of creation. */
export const DEFAULT_DEADLINE_SECONDS = 300; // 5 minutes

/** Maximum deadline offset allowed by the sweeper contract, in seconds. */
export const MAX_DEADLINE_SECONDS = 86_400; // 24 hours

/** Default Permit2 signature expiration, in seconds from signing time. */
export const DEFAULT_PERMIT_EXPIRY_SECONDS = 3_600; // 1 hour

/** Session TTL in the SDK's `SessionManager`, in milliseconds. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

// ─── Well-known addresses ─────────────────────────────────────────────────────

/**
 * Uniswap Permit2 contract address.
 * Deployed at the same deterministic address on every EVM chain.
 */
export const PERMIT2_ADDRESS =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

/** Null / zero EVM address used as a sentinel value. */
export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

/** Maximum uint256 value (2^256 − 1) — used for unlimited allowances. */
export const MAX_UINT256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n;

/** Maximum uint160 value — used for Permit2 unlimited token amounts. */
export const MAX_UINT160 = 1461501637330902918203684832716283019655932542975n;

/** Maximum uint48 value — used for non-expiring Permit2 allowances. */
export const MAX_UINT48 = 281474976710655n;

// ─── RPC / network ────────────────────────────────────────────────────────────

/** Default number of times the RPC provider retries a failed request. */
export const RPC_MAX_RETRIES = 3;

/** Initial backoff delay for RPC retries, in milliseconds. */
export const RPC_INITIAL_BACKOFF_MS = 500;

/** Maximum backoff delay for RPC retries, in milliseconds. */
export const RPC_MAX_BACKOFF_MS = 10_000;

/** RPC request timeout, in milliseconds. */
export const RPC_TIMEOUT_MS = 30_000;

/** Maximum number of concurrent RPC requests per provider. */
export const RPC_MAX_CONCURRENCY = 10;

// ─── Analytics ────────────────────────────────────────────────────────────────

/** Maximum number of events to buffer before flushing to the analytics endpoint. */
export const ANALYTICS_BATCH_SIZE = 20;

/** Maximum time between analytics flushes, in milliseconds. */
export const ANALYTICS_FLUSH_INTERVAL_MS = 10_000;

// ─── API ──────────────────────────────────────────────────────────────────────

/** Default number of items returned per page by the API. */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum number of items that can be requested per page. */
export const MAX_PAGE_SIZE = 100;

/** Current API version string included in request headers and webhook payloads. */
export const API_VERSION = "2024-07-01";
