/**
 * TokenList — sortable, filterable table of ERC-20 tokens with sweep selection.
 *
 * Features:
 *  - Sort by symbol, balance, or USD value (ascending/descending).
 *  - Filter by token name or symbol via a search input.
 *  - Select/deselect tokens with individual checkboxes or a "select all" header.
 *
 * @example
 * ```tsx
 * <TokenList
 *   tokens={balances}
 *   selectedAddresses={selected}
 *   onSelectionChange={setSelected}
 * />
 * ```
 */

"use client";

import * as React from "react";
import {
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SearchIcon,
} from "lucide-react";
import type { TokenWithBalance } from "@sw3/shared-types";
import { cn } from "../lib/utils.js";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TokenListProps {
  tokens: TokenWithBalance[];
  /** Set of currently selected token addresses. */
  selectedAddresses?: Set<string>;
  /** Called when the selection changes. */
  onSelectionChange?: (addresses: Set<string>) => void;
  /** Whether to show the USD value column. Defaults to `true`. */
  showUsdValue?: boolean;
  /** Additional CSS classes for the root element. */
  className?: string;
  /** Whether the list is in a loading state. */
  isLoading?: boolean;
}

// ─── Sort state ───────────────────────────────────────────────────────────────

type SortKey = "symbol" | "balance" | "usdValue";
type SortDir = "asc" | "desc";

function getSortIcon(
  key: SortKey,
  activeKey: SortKey,
  dir: SortDir,
): React.ReactNode {
  if (key !== activeKey)
    return <ArrowUpDownIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />;
  return dir === "asc"
    ? <ArrowUpIcon className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
    : <ArrowDownIcon className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Sortable, filterable token balance table with sweep selection checkboxes.
 */
export const TokenList: React.FC<TokenListProps> = ({
  tokens,
  selectedAddresses = new Set(),
  onSelectionChange,
  showUsdValue = true,
  className,
  isLoading = false,
}) => {
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("usdValue");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const handleSort = React.useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("desc");
      return key;
    });
  }, []);

  // Filter
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tokens;
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q),
    );
  }, [tokens, query]);

  // Sort
  const sorted = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "symbol") {
        cmp = a.symbol.localeCompare(b.symbol);
      } else if (sortKey === "balance") {
        cmp = a.balance < b.balance ? -1 : a.balance > b.balance ? 1 : 0;
      } else {
        const aVal = parseFloat(a.usdValue ?? "0");
        const bVal = parseFloat(b.usdValue ?? "0");
        cmp = aVal - bVal;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Selection helpers
  const isAllSelected =
    sorted.length > 0 && sorted.every((t) => selectedAddresses.has(t.address));
  const isIndeterminate =
    !isAllSelected && sorted.some((t) => selectedAddresses.has(t.address));

  const toggleAll = React.useCallback(() => {
    if (!onSelectionChange) return;
    if (isAllSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(sorted.map((t) => t.address)));
    }
  }, [isAllSelected, sorted, onSelectionChange]);

  const toggleOne = React.useCallback(
    (address: string) => {
      if (!onSelectionChange) return;
      const next = new Set(selectedAddresses);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      onSelectionChange(next);
    },
    [selectedAddresses, onSelectionChange],
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Search */}
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, symbol, or address…"
          aria-label="Filter tokens"
          className={cn(
            "w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm",
            "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
            "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
            "placeholder:text-gray-400",
          )}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          {/* Head */}
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              {onSelectionChange && (
                <th scope="col" className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={toggleAll}
                    aria-label="Select all tokens"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
              )}

              {/* Symbol */}
              <th scope="col" className="px-3 py-3 text-left">
                <button
                  type="button"
                  onClick={() => handleSort("symbol")}
                  className="inline-flex items-center gap-1 font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Token {getSortIcon("symbol", sortKey, sortDir)}
                </button>
              </th>

              {/* Balance */}
              <th scope="col" className="px-3 py-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort("balance")}
                  className="inline-flex items-center gap-1 font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Balance {getSortIcon("balance", sortKey, sortDir)}
                </button>
              </th>

              {/* USD value */}
              {showUsdValue && (
                <th scope="col" className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort("usdValue")}
                    className="inline-flex items-center gap-1 font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    USD Value {getSortIcon("usdValue", sortKey, sortDir)}
                  </button>
                </th>
              )}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {onSelectionChange && <td className="px-3 py-3" />}
                  <td className="px-3 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="ml-auto h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </td>
                  {showUsdValue && (
                    <td className="px-3 py-3">
                      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                  )}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={onSelectionChange ? (showUsdValue ? 4 : 3) : showUsdValue ? 3 : 2}
                  className="py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                >
                  {query ? `No tokens match "${query}"` : "No tokens found."}
                </td>
              </tr>
            ) : (
              sorted.map((token) => {
                const isSelected = selectedAddresses.has(token.address);
                return (
                  <tr
                    key={token.address}
                    className={cn(
                      "transition-colors duration-100",
                      isSelected
                        ? "bg-indigo-50/50 dark:bg-indigo-900/10"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                    )}
                  >
                    {onSelectionChange && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(token.address)}
                          aria-label={`Select ${token.symbol}`}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {token.logoUri && (
                          <img
                            src={token.logoUri}
                            alt={token.symbol}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {token.symbol}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                            {token.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                      {token.formattedBalance}
                    </td>
                    {showUsdValue && (
                      <td className="px-3 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                        {token.usdValue ?? "—"}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      {!isLoading && sorted.length > 0 && selectedAddresses.size > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {selectedAddresses.size} of {sorted.length} token
          {sorted.length > 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
};

TokenList.displayName = "TokenList";
