/**
 * RPC retry manager with exponential backoff and jitter.
 *
 * Provides a configurable retry policy for async operations that can fail
 * transiently (e.g. rate-limited RPC calls, flaky network connections).
 *
 * @example
 * ```ts
 * const retry = new RetryManager({ maxAttempts: 4, initialDelayMs: 200 });
 * const result = await retry.execute(() => fetchBlockNumber());
 * ```
 */

import { NetworkError, RateLimitError, SdkErrorCode, errOpts } from "../core/errors.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface RetryConfig {
  /** Maximum total attempts (including the first). Defaults to 3. */
  maxAttempts?: number;
  /** Delay for the first retry in ms. Doubles each attempt. Defaults to 500. */
  initialDelayMs?: number;
  /** Hard cap on the delay between retries. Defaults to 10 000 ms. */
  maxDelayMs?: number;
  /**
   * Maximum random jitter added to each delay in ms.
   * Jitter prevents thundering-herd when many clients retry simultaneously.
   * Defaults to 200 ms.
   */
  jitterMs?: number;
  /**
   * Predicate that decides whether an error should trigger a retry.
   * By default, {@link NetworkError} and {@link RateLimitError} are retried;
   * all other errors are not.
   */
  isRetryable?: (error: unknown) => boolean;
  /** Optional callback fired before each retry. */
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

// ─── Default retryable check ──────────────────────────────────────────────────

function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof NetworkError) return true;
  // Retry JSON-RPC transport errors (fetch failures, 5xx responses)
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("rate limit") ||
      msg.includes("429") ||
      msg.includes("503") ||
      msg.includes("502") ||
      msg.includes("504")
    ) {
      return true;
    }
  }
  return false;
}

// ─── RetryManager ─────────────────────────────────────────────────────────────

export class RetryManager {
  private readonly maxAttempts: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitterMs: number;
  private readonly isRetryable: (error: unknown) => boolean;
  private readonly onRetry:
    | ((attempt: number, delayMs: number, error: unknown) => void)
    | undefined;

  constructor(config: RetryConfig = {}) {
    this.maxAttempts = config.maxAttempts ?? 3;
    this.initialDelayMs = config.initialDelayMs ?? 500;
    this.maxDelayMs = config.maxDelayMs ?? 10_000;
    this.jitterMs = config.jitterMs ?? 200;
    this.isRetryable = config.isRetryable ?? defaultIsRetryable;
    this.onRetry = config.onRetry;
  }

  /**
   * Executes `fn`, retrying on retryable errors up to `maxAttempts` total
   * attempts with exponential backoff + jitter.
   *
   * @throws The last error seen if all attempts fail, wrapped in
   *         {@link NetworkError} if it wasn't already a {@link SweeperError}.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;

        const isLast = attempt === this.maxAttempts;
        if (isLast || !this.isRetryable(err)) {
          break;
        }

        const exponential = this.initialDelayMs * 2 ** (attempt - 1);
        const capped = Math.min(exponential, this.maxDelayMs);
        const jitter = Math.random() * this.jitterMs;
        const delayMs = Math.round(capped + jitter);

        this.onRetry?.(attempt, delayMs, err);
        await sleep(delayMs);
      }
    }

    // Re-throw as a NetworkError if it isn't already a recognised SDK error
    if (
      lastError instanceof Error &&
      !(lastError as { code?: string }).code?.startsWith("SDK_")
    ) {
      throw new NetworkError(`Operation failed after ${this.maxAttempts} attempts: ${lastError.message}`, {
        cause: lastError,
        context: { maxAttempts: this.maxAttempts },
      });
    }
    throw lastError;
  }

  /** Computes the delay for the given retry attempt (1-indexed). */
  delayFor(attempt: number): number {
    const exponential = this.initialDelayMs * 2 ** (attempt - 1);
    const capped = Math.min(exponential, this.maxDelayMs);
    return Math.round(capped + Math.random() * this.jitterMs);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a Promise that resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One-shot retry helper for simple cases that don't need a full `RetryManager`
 * instance.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: RetryConfig,
): Promise<T> {
  return new RetryManager(config).execute(fn);
}

/**
 * Wraps a value returned by `fn` that might throw with the given error code.
 * Useful for tagging low-level errors with SDK error codes.
 */
export async function withErrorCode<T>(
  fn: () => Promise<T>,
  code: SdkErrorCode,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if ((err as { code?: string })?.code?.startsWith("SDK_")) throw err;
    throw new NetworkError(
      err instanceof Error ? err.message : String(err),
      errOpts(err, { ...context, originalCode: code }),
    );
  }
}
