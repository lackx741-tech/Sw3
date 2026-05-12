/**
 * SweepModal — token sweep configuration dialog.
 *
 * Guides the user through:
 *  1. Selecting tokens to sweep (from a provided list).
 *  2. Setting amounts and the destination address.
 *  3. Previewing estimated fees.
 *  4. Confirming or cancelling the sweep.
 *
 * @example
 * ```tsx
 * <SweepModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   tokens={tokenBalances}
 *   onConfirm={(legs) => executor.execute(await builder.build())}
 * />
 * ```
 */

"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { XIcon, ArrowRightIcon, Loader2Icon, AlertCircleIcon } from "lucide-react";
import type { TokenWithBalance } from "@sw3/shared-types";
import { cn } from "../lib/utils.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SweepLegInput {
  token: TokenWithBalance;
  amount: string;
  to: string;
  feeBps: number;
}

export interface SweepModalProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Tokens available for sweeping (with balances). */
  tokens: TokenWithBalance[];
  /** Default recipient address. */
  defaultRecipient?: `0x${string}`;
  /** Default fee in basis points. */
  defaultFeeBps?: number;
  /** Called when the user confirms the sweep. */
  onConfirm: (legs: SweepLegInput[]) => Promise<void> | void;
  /** Whether a sweep is currently in progress. */
  isSubmitting?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TokenRowProps {
  token: TokenWithBalance;
  selected: boolean;
  onToggle: () => void;
  amount: string;
  onAmountChange: (v: string) => void;
}

const TokenRow: React.FC<TokenRowProps> = ({
  token,
  selected,
  onToggle,
  amount,
  onAmountChange,
}) => (
  <div
    className={cn(
      "flex items-center gap-3 rounded-lg border p-3 transition-colors",
      selected
        ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20"
        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900",
    )}
  >
    {/* Checkbox */}
    <input
      id={`token-${token.address}`}
      type="checkbox"
      checked={selected}
      onChange={onToggle}
      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      aria-label={`Select ${token.symbol}`}
    />

    {/* Token info */}
    <label
      htmlFor={`token-${token.address}`}
      className="flex min-w-0 flex-1 cursor-pointer flex-col"
    >
      <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
        {token.symbol}
      </span>
      <span className="truncate text-xs text-gray-500 dark:text-gray-400">
        Balance: {token.formattedBalance}
        {token.usdValue && ` (${token.usdValue})`}
      </span>
    </label>

    {/* Amount input */}
    {selected && (
      <input
        type="number"
        min="0"
        step="any"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        placeholder={token.formattedBalance}
        aria-label={`Amount for ${token.symbol}`}
        className={cn(
          "w-28 rounded-md border border-gray-300 px-2 py-1 text-right text-sm",
          "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
          "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
        )}
      />
    )}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Full-screen (on mobile) / centred (on desktop) sweep configuration dialog.
 */
export const SweepModal: React.FC<SweepModalProps> = ({
  open,
  onOpenChange,
  tokens,
  defaultRecipient = "",
  defaultFeeBps = 30,
  onConfirm,
  isSubmitting = false,
}) => {
  const [recipient, setRecipient] = React.useState<string>(defaultRecipient);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [amounts, setAmounts] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelected(new Set());
      setAmounts({});
      setError(null);
      setRecipient(defaultRecipient);
    }
  }, [open, defaultRecipient]);

  const toggleToken = React.useCallback((address: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
  }, []);

  const setAmount = React.useCallback((address: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [address]: value }));
  }, []);

  // Compute fee preview
  const selectedTokens = tokens.filter((t) => selected.has(t.address));
  const totalUsd = selectedTokens.reduce((sum, t) => {
    return sum + (t.usdValue ? parseFloat(t.usdValue.replace(/[$,]/g, "")) : 0);
  }, 0);
  const estimatedFeeUsd = (totalUsd * defaultFeeBps) / 10_000;

  const handleConfirm = async () => {
    setError(null);

    if (selected.size === 0) {
      setError("Please select at least one token to sweep.");
      return;
    }

    if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      setError("Please enter a valid recipient address.");
      return;
    }

    const legs: SweepLegInput[] = selectedTokens.map((token) => ({
      token,
      amount: amounts[token.address] ?? token.formattedBalance,
      to: recipient,
      feeBps: defaultFeeBps,
    }));

    try {
      await onConfirm(legs);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sweep failed. Please try again.");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm",
            "animate-in fade-in-0",
          )}
        />

        {/* Content */}
        <Dialog.Content
          aria-describedby="sweep-modal-description"
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
            "rounded-xl bg-white shadow-xl dark:bg-gray-950",
            "border border-gray-200 dark:border-gray-800",
            "animate-in fade-in-0 zoom-in-95",
            "flex max-h-[90vh] flex-col",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-gray-800">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Sweep Tokens
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className={cn(
                "rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600",
                "dark:hover:bg-gray-800 dark:hover:text-gray-300",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500",
                "transition-colors",
              )}
            >
              <XIcon className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <p
              id="sweep-modal-description"
              className="text-sm text-gray-500 dark:text-gray-400"
            >
              Select the tokens you want to sweep and set the destination address.
            </p>

            {/* Recipient */}
            <div className="space-y-1">
              <label
                htmlFor="sweep-recipient"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Recipient address
              </label>
              <input
                id="sweep-recipient"
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x…"
                className={cn(
                  "w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm",
                  "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
                  "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
                  "placeholder:text-gray-400",
                )}
              />
            </div>

            {/* Token list */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select tokens ({selected.size} selected)
              </p>
              {tokens.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400 dark:border-gray-700">
                  No tokens found in this wallet.
                </p>
              ) : (
                tokens.map((token) => (
                  <TokenRow
                    key={token.address}
                    token={token}
                    selected={selected.has(token.address)}
                    onToggle={() => toggleToken(token.address)}
                    amount={amounts[token.address] ?? ""}
                    onAmountChange={(v) => setAmount(token.address, v)}
                  />
                ))
              )}
            </div>

            {/* Fee preview */}
            {selected.size > 0 && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Estimated value</span>
                  <span>${totalUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Platform fee ({(defaultFeeBps / 100).toFixed(2)}%)</span>
                  <span className="text-orange-600 dark:text-orange-400">
                    −${estimatedFeeUsd.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span>You receive</span>
                  <span>${(totalUsd - estimatedFeeUsd).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
              >
                <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-gray-100 p-6 dark:border-gray-800">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={isSubmitting}
                className={cn(
                  "flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium",
                  "text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300",
                  "dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-gray-400 transition-colors disabled:opacity-50",
                )}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || selected.size === 0}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2",
                "text-sm font-semibold text-white",
                "bg-indigo-600 hover:bg-indigo-700",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                "focus-visible:outline-indigo-600 transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Sweeping…
                </>
              ) : (
                <>
                  Sweep {selected.size > 0 ? `${selected.size} token${selected.size > 1 ? "s" : ""}` : "tokens"}
                  <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

SweepModal.displayName = "SweepModal";
