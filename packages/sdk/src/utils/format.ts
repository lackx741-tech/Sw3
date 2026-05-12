/**
 * Formatting utilities for the Sw3 SDK.
 *
 * All functions are pure (no side effects) and safe to use in both Node and
 * browser environments.
 */

import { BPS_DENOMINATOR } from "@sw3/config";

// ─── Amount formatting ────────────────────────────────────────────────────────

/**
 * Formats a raw token amount (bigint, in smallest unit) into a human-readable
 * decimal string.
 *
 * @param amount - Raw amount (e.g. 1_000_000n for 1 USDC).
 * @param decimals - Token decimal places (e.g. 6 for USDC, 18 for ETH).
 * @param displayDecimals - Number of decimal places to show. Defaults to 4.
 *
 * @example
 * ```ts
 * formatAmount(1_000_000n, 6, 2) // "1.00"
 * formatAmount(123_456_789_000_000_000n, 18, 4) // "0.1235"
 * ```
 */
export function formatAmount(
  amount: bigint,
  decimals: number,
  displayDecimals = 4,
): string {
  if (amount === 0n) return "0";

  const divisor = 10n ** BigInt(decimals);
  const integerPart = amount / divisor;
  const remainder = amount % divisor;

  if (remainder === 0n) {
    return integerPart.toString();
  }

  // Pad remainder with leading zeros to `decimals` places
  const paddedRemainder = remainder
    .toString()
    .padStart(decimals, "0")
    .slice(0, displayDecimals)
    .replace(/0+$/, "");

  if (!paddedRemainder) return integerPart.toString();

  return `${integerPart}.${paddedRemainder}`;
}

/**
 * Parses a human-readable decimal string into a raw bigint amount.
 *
 * @param value - Human-readable string, e.g. "1.5" or "1000".
 * @param decimals - Token decimal precision.
 * @throws {Error} if `value` is not a valid non-negative decimal number.
 *
 * @example
 * ```ts
 * parseAmount("1.5", 6) // 1_500_000n
 * parseAmount("1000", 18) // 1_000_000_000_000_000_000_000n
 * ```
 */
export function parseAmount(value: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error(`Invalid amount: "${value}"`);
  }

  const [intStr, fracStr = ""] = value.split(".");
  const paddedFrac = fracStr.padEnd(decimals, "0").slice(0, decimals);
  const full = `${intStr ?? "0"}${paddedFrac}`;
  return BigInt(full);
}

// ─── Address formatting ───────────────────────────────────────────────────────

/**
 * Truncates an EVM address to the canonical "0x1234…abcd" display format.
 *
 * @param address - Full 42-character checksummed address.
 * @param prefixChars - Characters to show after "0x". Defaults to 4.
 * @param suffixChars - Characters to show at the end. Defaults to 4.
 *
 * @example
 * ```ts
 * formatAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
 * // "0xd8dA…6045"
 * ```
 */
export function formatAddress(
  address: `0x${string}`,
  prefixChars = 4,
  suffixChars = 4,
): string {
  if (address.length <= 2 + prefixChars + suffixChars) return address;
  const prefix = address.slice(0, 2 + prefixChars);
  const suffix = address.slice(-suffixChars);
  return `${prefix}…${suffix}`;
}

// ─── Transaction hash formatting ──────────────────────────────────────────────

/**
 * Truncates a 66-character transaction hash to a short display form.
 *
 * @example
 * ```ts
 * formatTxHash("0xabc123...def456") // "0xabc1…f456"
 * ```
 */
export function formatTxHash(
  hash: `0x${string}`,
  prefixChars = 4,
  suffixChars = 4,
): string {
  if (hash.length <= 2 + prefixChars + suffixChars) return hash;
  const prefix = hash.slice(0, 2 + prefixChars);
  const suffix = hash.slice(-suffixChars);
  return `${prefix}…${suffix}`;
}

// ─── Fee / BPS formatting ─────────────────────────────────────────────────────

/**
 * Converts a basis-point value to a human-readable percentage string.
 *
 * @param bps - Fee in basis points (e.g. 30 for 0.30 %).
 * @param fractionDigits - Decimal places in the output. Defaults to 2.
 *
 * @example
 * ```ts
 * formatBps(30)   // "0.30%"
 * formatBps(1000) // "10.00%"
 * formatBps(1)    // "0.01%"
 * ```
 */
export function formatBps(bps: number, fractionDigits = 2): string {
  const pct = (bps / BPS_DENOMINATOR) * 100;
  return `${pct.toFixed(fractionDigits)}%`;
}

/**
 * Formats a USD value string with commas and a currency symbol.
 *
 * @example
 * ```ts
 * formatUsd("1234567.89") // "$1,234,567.89"
 * ```
 */
export function formatUsd(
  usdString: string,
  fractionDigits = 2,
): string {
  const num = Number(usdString);
  if (Number.isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(num);
}

/**
 * Converts a Wei-denominated gas price (bigint) to a human-readable Gwei
 * string.
 *
 * @example
 * ```ts
 * formatGwei(25_000_000_000n) // "25.0 Gwei"
 * ```
 */
export function formatGwei(weiAmount: bigint): string {
  const gwei = Number(weiAmount) / 1e9;
  return `${gwei.toFixed(1)} Gwei`;
}

/**
 * Returns a relative time string (e.g. "2 minutes ago") for an ISO-8601 or
 * Unix-timestamp date.
 */
export function formatRelativeTime(
  date: string | number | Date,
): string {
  const ts = typeof date === "object" ? date.getTime() : typeof date === "number" ? date : new Date(date).getTime();
  const diff = Date.now() - ts;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const seconds = Math.round(diff / 1_000);
  if (Math.abs(seconds) < 60) return rtf.format(-seconds, "second");

  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");

  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");

  const days = Math.round(diff / 86_400_000);
  return rtf.format(-days, "day");
}
