/**
 * Environment variable schema for the Sw3 platform.
 *
 * Validated with Zod so that missing or malformed env vars cause a clear
 * error at start-up rather than a cryptic runtime failure.
 *
 * This module exports both the raw Zod schemas and the parsed, typed result.
 * Server-side services should use `parseServerEnv()`; browser/SDK code should
 * use `parseClientEnv()`.
 */

import { z } from "zod";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const address = () =>
  z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a checksummed EVM address")
    .transform((v) => v as `0x${string}`);

const url = () => z.string().url("Must be a valid URL");

const positiveInt = () =>
  z.coerce.number().int().positive("Must be a positive integer");

// ─── Client / browser env schema ──────────────────────────────────────────────

/**
 * Environment variables that are safe to expose to the browser (NEXT_PUBLIC_*
 * or VITE_* prefix).
 */
export const clientEnvSchema = z.object({
  /** EVM chain ID the frontend defaults to. */
  NEXT_PUBLIC_CHAIN_ID: z.coerce
    .number()
    .int()
    .positive()
    .default(1)
    .describe("Default EVM chain ID"),

  /** Primary RPC URL used by the frontend public client. */
  NEXT_PUBLIC_RPC_URL: url()
    .optional()
    .describe("Primary JSON-RPC endpoint for the frontend"),

  /** Sw3 API base URL consumed by the frontend. */
  NEXT_PUBLIC_API_URL: url()
    .default("https://api.sw3.io")
    .describe("Sw3 REST API base URL"),

  /** WalletConnect v2 project ID. */
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z
    .string()
    .min(1)
    .optional()
    .describe("WalletConnect v2 project ID"),

  /** Optional: override the sweeper contract address (useful for testnet). */
  NEXT_PUBLIC_SWEEPER_ADDRESS: address()
    .optional()
    .describe("Sweeper contract address override"),

  /** Optional: override the permit router address. */
  NEXT_PUBLIC_PERMIT_ROUTER_ADDRESS: address()
    .optional()
    .describe("Permit router contract address override"),

  /** Sentry DSN for frontend error tracking. */
  NEXT_PUBLIC_SENTRY_DSN: url()
    .optional()
    .describe("Sentry DSN for browser error tracking"),

  /** Analytics write key. */
  NEXT_PUBLIC_ANALYTICS_KEY: z
    .string()
    .optional()
    .describe("Analytics write key"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

// ─── Server env schema ────────────────────────────────────────────────────────

/**
 * Server-only environment variables.
 * Never expose these to the browser.
 */
export const serverEnvSchema = z.object({
  /** Node environment. */
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** PostgreSQL connection URL. */
  DATABASE_URL: z
    .string()
    .url()
    .describe("PostgreSQL connection URL (with credentials)"),

  /** Redis connection URL. */
  REDIS_URL: z.string().url().describe("Redis connection URL"),

  /** JWT signing secret (≥ 32 characters). */
  JWT_SECRET: z.string().min(32).describe("JWT signing secret"),

  /** API key for internal service-to-service authentication. */
  INTERNAL_API_KEY: z.string().min(16).describe("Internal service API key"),

  /** Sw3 API base URL (for server-side fetches). */
  API_URL: url().default("https://api.sw3.io"),

  /** Maximum requests per minute per IP for the public API. */
  RATE_LIMIT_RPM: positiveInt().default(60),

  /** Private key of the relayer hot wallet (hex, no 0x prefix). */
  RELAYER_PRIVATE_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "Must be a 64-char hex private key")
    .optional()
    .describe("Relayer signing key"),

  /** OpenTelemetry collector endpoint. */
  OTEL_EXPORTER_OTLP_ENDPOINT: url()
    .optional()
    .describe("OTLP collector endpoint"),

  /** Sentry DSN for the server. */
  SENTRY_DSN: url().optional().describe("Sentry DSN for server-side tracking"),

  /** Webhook HMAC signing secret. */
  WEBHOOK_SECRET: z
    .string()
    .min(16)
    .optional()
    .describe("HMAC-SHA256 webhook signing secret"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

// ─── Parse helpers ────────────────────────────────────────────────────────────

/** Returns `process.env` when running in Node, or `{}` in the browser. */
function getProcessEnv(): Record<string, string | undefined> {
  return typeof (globalThis as Record<string, unknown>)["process"] !== "undefined"
    ? (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env
    : {};
}

/**
 * Parses and validates client-side environment variables.
 *
 * @param env - Source object (defaults to `process.env` when available).
 * @throws {ZodError} if any required variable is missing or malformed.
 */
export function parseClientEnv(
  env: Record<string, string | undefined> = getProcessEnv(),
): ClientEnv {
  const result = clientEnvSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid client environment variables:\n${issues}`);
  }
  return result.data;
}

/**
 * Parses and validates server-side environment variables.
 *
 * @param env - Source object (defaults to `process.env`).
 * @throws {ZodError} if any required variable is missing or malformed.
 */
export function parseServerEnv(
  env: Record<string, string | undefined> = getProcessEnv(),
): ServerEnv {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment variables:\n${issues}`);
  }
  return result.data;
}
