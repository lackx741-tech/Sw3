/**
 * Input validation utilities for the Sw3 SDK.
 *
 * All validators return a typed `Result` object (`{ ok: true, value }` or
 * `{ ok: false, error }`), so callers can handle errors without try/catch.
 * Zod schemas are also exported for use in form libraries (react-hook-form,
 * etc.).
 */

import { z } from "zod";
import { ChainId } from "@sw3/shared-types";
import { MAX_BATCH_SIZE, MAX_FEE_BPS } from "@sw3/config";

// ─── Result type ──────────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// ─── Zod schemas ──────────────────────────────────────────────────────────────

/** Validates a checksummed 20-byte EVM address string. */
export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid EVM address (0x + 40 hex chars)")
  .transform((v) => v as `0x${string}`);

/** Validates a positive decimal amount string (no scientific notation). */
export const amountStringSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a positive decimal number")
  .refine((v) => Number(v) > 0, "Amount must be greater than zero");

/** Validates a positive bigint amount. */
export const amountBigintSchema = z
  .bigint()
  .positive("Amount must be greater than zero");

/** Validates a chain ID against the known supported list. */
export const chainIdSchema = z
  .number()
  .int()
  .refine(
    (v): v is ChainId =>
      Object.values(ChainId).includes(v as ChainId),
    `Must be a supported chain ID (${Object.values(ChainId)
      .filter((v) => typeof v === "number")
      .join(", ")})`,
  );

/** Validates a basis-point fee value (0–MAX_FEE_BPS). */
export const feeBpsSchema = z
  .number()
  .int()
  .min(0, "Fee must be ≥ 0 bps")
  .max(MAX_FEE_BPS, `Fee must be ≤ ${MAX_FEE_BPS} bps`);

/** Validates a batch size (1–MAX_BATCH_SIZE). */
export const batchSizeSchema = z
  .number()
  .int()
  .min(1, "Batch must contain at least one leg")
  .max(MAX_BATCH_SIZE, `Batch cannot exceed ${MAX_BATCH_SIZE} legs`);

/** Validates a 65-byte hex signature (0x + 130 hex chars). */
export const signatureSchema = z
  .string()
  .regex(
    /^0x[0-9a-fA-F]{130}$/,
    "Must be a valid 65-byte EIP-712 signature",
  )
  .transform((v) => v as `0x${string}`);

/** Validates a 32-byte hex transaction / permit hash. */
export const bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Must be a valid bytes32 hex value")
  .transform((v) => v as `0x${string}`);

// ─── Helper validators ────────────────────────────────────────────────────────

/**
 * Validates an EVM address.
 *
 * @example
 * ```ts
 * const result = validateAddress("0xabc...");
 * if (result.ok) console.log(result.value); // `0x${string}`
 * ```
 */
export function validateAddress(
  input: string,
): ValidationResult<`0x${string}`> {
  const parsed = addressSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid address" };
}

/**
 * Validates a positive bigint token amount.
 */
export function validateAmount(input: bigint): ValidationResult<bigint> {
  const parsed = amountBigintSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid amount" };
}

/**
 * Validates an EVM chain ID against the supported chain list.
 */
export function validateChainId(input: number): ValidationResult<ChainId> {
  const parsed = chainIdSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: parsed.error.issues[0]?.message ?? "Unsupported chain" };
}

/**
 * Validates a sweep batch size.
 */
export function validateBatchSize(input: number): ValidationResult<number> {
  const parsed = batchSizeSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid batch size" };
}

/**
 * Validates a fee in basis points.
 */
export function validateFeeBps(input: number): ValidationResult<number> {
  const parsed = feeBpsSchema.safeParse(input);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid fee" };
}

// ─── Composite schema (for full sweep leg input) ──────────────────────────────

/** Full sweep leg input schema used by form validation. */
export const sweepLegInputSchema = z.object({
  token: addressSchema,
  from: addressSchema,
  to: addressSchema,
  amount: amountBigintSchema,
  feeBps: feeBpsSchema,
});

export type SweepLegInput = z.infer<typeof sweepLegInputSchema>;
