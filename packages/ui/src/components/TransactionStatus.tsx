/**
 * TransactionStatus — animated sweep transaction lifecycle indicator.
 *
 * Displays one of three visual states:
 *  - **Pending** — animated spinner with "Transaction pending" copy.
 *  - **Confirmed** — green check with tx hash link + block explorer link.
 *  - **Failed** — red X with error message and optional retry button.
 *
 * @example
 * ```tsx
 * <TransactionStatus
 *   status="confirmed"
 *   txHash="0xabc..."
 *   chainId={ChainId.Mainnet}
 * />
 * ```
 */

"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  ExternalLinkIcon,
  CopyIcon,
  CheckIcon,
} from "lucide-react";
import { ChainId } from "@sw3/shared-types";
import { cn } from "../lib/utils.js";

// ─── Props ────────────────────────────────────────────────────────────────────

export type TxStatus = "pending" | "confirmed" | "failed";

export interface TransactionStatusProps {
  status: TxStatus;
  /** Transaction hash (required for confirmed/failed states). */
  txHash?: `0x${string}`;
  /** Chain the transaction was submitted on (used to build the explorer URL). */
  chainId?: ChainId;
  /** Human-readable error message (shown in "failed" state). */
  errorMessage?: string;
  /** Called when the user clicks "Retry". */
  onRetry?: () => void;
  /** Additional CSS classes. */
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BLOCK_EXPLORERS: Record<ChainId, string> = {
  [ChainId.Mainnet]: "https://etherscan.io",
  [ChainId.Goerli]: "https://goerli.etherscan.io",
  [ChainId.Sepolia]: "https://sepolia.etherscan.io",
  [ChainId.Arbitrum]: "https://arbiscan.io",
  [ChainId.Optimism]: "https://optimistic.etherscan.io",
  [ChainId.Polygon]: "https://polygonscan.com",
  [ChainId.Base]: "https://basescan.org",
};

function txExplorerUrl(
  chainId: ChainId | undefined,
  txHash: `0x${string}`,
): string {
  const base =
    chainId !== undefined
      ? (BLOCK_EXPLORERS[chainId] ?? "https://etherscan.io")
      : "https://etherscan.io";
  return `${base}/tx/${txHash}`;
}

function truncateHash(hash: `0x${string}`): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Transaction lifecycle status card with animated state transitions.
 */
export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  status,
  txHash,
  chainId,
  errorMessage,
  onRetry,
  className,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyHash = React.useCallback(async () => {
    if (!txHash) return;
    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  }, [txHash]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Transaction ${status}`}
      className={cn(
        "rounded-xl border p-5",
        status === "pending" &&
          "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20",
        status === "confirmed" &&
          "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20",
        status === "failed" &&
          "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20",
        className,
      )}
    >
      {/* Icon + title row */}
      <div className="flex items-center gap-3 mb-3">
        {status === "pending" && (
          <Loader2Icon
            className="h-6 w-6 animate-spin text-blue-500 dark:text-blue-400 shrink-0"
            aria-hidden="true"
          />
        )}
        {status === "confirmed" && (
          <CheckCircle2Icon
            className="h-6 w-6 text-green-500 dark:text-green-400 shrink-0"
            aria-hidden="true"
          />
        )}
        {status === "failed" && (
          <XCircleIcon
            className="h-6 w-6 text-red-500 dark:text-red-400 shrink-0"
            aria-hidden="true"
          />
        )}

        <p
          className={cn(
            "font-semibold",
            status === "pending" && "text-blue-700 dark:text-blue-300",
            status === "confirmed" && "text-green-700 dark:text-green-300",
            status === "failed" && "text-red-700 dark:text-red-300",
          )}
        >
          {status === "pending" && "Transaction pending…"}
          {status === "confirmed" && "Transaction confirmed!"}
          {status === "failed" && "Transaction failed"}
        </p>
      </div>

      {/* Sub-content */}
      {status === "pending" && (
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Waiting for the transaction to be included in a block. This may take
          a few moments.
        </p>
      )}

      {status === "confirmed" && txHash && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-green-700 dark:text-green-400">
            Your sweep has been finalised on-chain.
          </p>

          {/* Tx hash row */}
          <div className="flex items-center gap-2 mt-1">
            <code className="rounded bg-green-100 dark:bg-green-900/30 px-2 py-0.5 font-mono text-xs text-green-800 dark:text-green-300">
              {truncateHash(txHash)}
            </code>

            {/* Copy hash */}
            <button
              type="button"
              onClick={handleCopyHash}
              aria-label="Copy transaction hash"
              className={cn(
                "rounded p-1 text-green-600 dark:text-green-400",
                "hover:bg-green-100 dark:hover:bg-green-900/30",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500",
                "transition-colors",
              )}
            >
              {copied ? (
                <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            {/* Block explorer link */}
            <a
              href={txExplorerUrl(chainId, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on block explorer"
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
                "text-green-700 dark:text-green-300",
                "hover:bg-green-100 dark:hover:bg-green-900/30",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500",
                "transition-colors",
              )}
            >
              View on explorer
              <ExternalLinkIcon className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="flex flex-col gap-3">
          {errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          {txHash && (
            <a
              href={txExplorerUrl(chainId, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex w-fit items-center gap-1 text-xs font-medium",
                "text-red-600 dark:text-red-400 underline underline-offset-2",
                "hover:text-red-800 dark:hover:text-red-300 transition-colors",
              )}
            >
              View on explorer
              <ExternalLinkIcon className="h-3 w-3" aria-hidden="true" />
            </a>
          )}

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                "w-fit rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium",
                "text-red-700 dark:border-red-700 dark:text-red-300",
                "hover:bg-red-100 dark:hover:bg-red-900/30",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500",
                "transition-colors",
              )}
            >
              Retry sweep
            </button>
          )}
        </div>
      )}
    </div>
  );
};

TransactionStatus.displayName = "TransactionStatus";
