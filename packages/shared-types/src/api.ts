/**
 * API envelope types for the Sw3 platform REST API.
 *
 * All API responses are wrapped in {@link ApiResponse} or
 * {@link PaginatedResponse}.  Webhook events follow the {@link WebhookPayload}
 * shape.
 */

// ─── Error codes ──────────────────────────────────────────────────────────────

/**
 * Machine-readable error codes returned by the API.
 * Front-ends should switch on these codes rather than parsing error messages.
 */
export enum ErrorCode {
  // 4xx client errors
  BadRequest = "BAD_REQUEST",
  Unauthorized = "UNAUTHORIZED",
  Forbidden = "FORBIDDEN",
  NotFound = "NOT_FOUND",
  Conflict = "CONFLICT",
  UnprocessableEntity = "UNPROCESSABLE_ENTITY",
  TooManyRequests = "TOO_MANY_REQUESTS",
  // 5xx server errors
  InternalServerError = "INTERNAL_SERVER_ERROR",
  ServiceUnavailable = "SERVICE_UNAVAILABLE",
  GatewayTimeout = "GATEWAY_TIMEOUT",
  // Domain-specific codes
  InvalidAddress = "INVALID_ADDRESS",
  InvalidAmount = "INVALID_AMOUNT",
  InsufficientBalance = "INSUFFICIENT_BALANCE",
  InvalidSignature = "INVALID_SIGNATURE",
  PermitExpired = "PERMIT_EXPIRED",
  BatchTooLarge = "BATCH_TOO_LARGE",
  ChainNotSupported = "CHAIN_NOT_SUPPORTED",
  TokenNotSupported = "TOKEN_NOT_SUPPORTED",
  SweepAlreadyFinalised = "SWEEP_ALREADY_FINALISED",
  NonceMismatch = "NONCE_MISMATCH",
  RpcError = "RPC_ERROR",
  SimulationFailed = "SIMULATION_FAILED",
}

// ─── Error payload ────────────────────────────────────────────────────────────

/**
 * Structured API error returned inside {@link ApiResponse} when
 * `success === false`.
 */
export interface ApiError {
  /** Machine-readable error code. */
  code: ErrorCode;
  /** Human-readable message suitable for developer logs. */
  message: string;
  /** Field-level validation errors, keyed by field path. */
  fieldErrors?: Record<string, string[]>;
  /** Optional correlation ID for server-side trace look-up. */
  traceId?: string;
}

// ─── Generic response envelope ────────────────────────────────────────────────

/**
 * Standard JSON envelope for all Sw3 API responses.
 *
 * @template T - The shape of the successful response payload.
 */
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      /** ISO-8601 timestamp when the response was generated. */
      timestamp: string;
      /** Correlation request ID echoed from the `X-Request-Id` header. */
      requestId: string;
    }
  | {
      success: false;
      error: ApiError;
      timestamp: string;
      requestId: string;
    };

// ─── Pagination ───────────────────────────────────────────────────────────────

/** Cursor-based pagination metadata included in list responses. */
export interface PaginationMeta {
  /** Opaque cursor pointing to the next page, or `null` on the last page. */
  nextCursor: string | null;
  /** Opaque cursor pointing to the previous page, or `null` on the first page. */
  prevCursor: string | null;
  /** Total number of items across all pages (may be an estimate). */
  total: number;
  /** Number of items in the current page. */
  count: number;
  /** Items per page that was requested. */
  limit: number;
}

/**
 * Paginated list response wrapping an array of {@link T}.
 *
 * @template T - Array element type.
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

/** Webhook event types emitted by the Sw3 platform. */
export type WebhookEvent =
  | "sweep.created"
  | "sweep.submitted"
  | "sweep.confirmed"
  | "sweep.finalised"
  | "sweep.failed"
  | "sweep.cancelled"
  | "batch.created"
  | "batch.executed"
  | "token.price_updated"
  | "wallet.connected"
  | "wallet.disconnected";

/**
 * Payload delivered to a registered webhook endpoint.
 * The `data` field shape varies by {@link WebhookEvent}.
 */
export interface WebhookPayload<T = unknown> {
  /** Unique delivery ID for idempotency checking. */
  id: string;
  /** Event type. */
  event: WebhookEvent;
  /** ISO-8601 timestamp when the event was generated on the server. */
  createdAt: string;
  /** API version that produced this payload, e.g. "2024-07-01". */
  apiVersion: string;
  /** Event-specific data. */
  data: T;
  /** HMAC-SHA256 signature of the raw request body, prefixed `sha256=`. */
  signature: string;
}
