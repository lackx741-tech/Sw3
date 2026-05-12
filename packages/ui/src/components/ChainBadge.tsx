/**
 * ChainBadge — compact chain name + colour badge.
 *
 * Renders a small pill badge identifying the currently active EVM chain.
 * Used inside WalletButton and SweepModal headers.
 *
 * @example
 * ```tsx
 * <ChainBadge chainId={ChainId.Arbitrum} />
 * <ChainBadge chainId={ChainId.Mainnet} size="lg" />
 * ```
 */

import * as React from "react";
import { ChainId } from "@sw3/shared-types";
import { cn } from "../lib/utils.js";

export interface ChainBadgeProps {
  chainId: ChainId;
  /** Visual size of the badge. Defaults to "sm". */
  size?: "xs" | "sm" | "md" | "lg";
  /** Additional CSS classes. */
  className?: string;
  /** Whether to show the chain icon. Defaults to true. */
  showIcon?: boolean;
}

// ─── Chain metadata ───────────────────────────────────────────────────────────

interface ChainMeta {
  name: string;
  shortName: string;
  /** Tailwind background colour class. */
  bgClass: string;
  /** Tailwind text colour class. */
  textClass: string;
  /** Unicode / emoji icon. */
  icon: string;
}

const CHAIN_META: Record<ChainId, ChainMeta> = {
  [ChainId.Mainnet]: {
    name: "Ethereum",
    shortName: "ETH",
    bgClass: "bg-blue-100 dark:bg-blue-900/40",
    textClass: "text-blue-700 dark:text-blue-300",
    icon: "⟠",
  },
  [ChainId.Goerli]: {
    name: "Goerli",
    shortName: "GTH",
    bgClass: "bg-blue-50 dark:bg-blue-950/40",
    textClass: "text-blue-500 dark:text-blue-400",
    icon: "⟠",
  },
  [ChainId.Sepolia]: {
    name: "Sepolia",
    shortName: "SEP",
    bgClass: "bg-indigo-50 dark:bg-indigo-950/40",
    textClass: "text-indigo-600 dark:text-indigo-300",
    icon: "⟠",
  },
  [ChainId.Arbitrum]: {
    name: "Arbitrum",
    shortName: "ARB",
    bgClass: "bg-sky-100 dark:bg-sky-900/40",
    textClass: "text-sky-700 dark:text-sky-300",
    icon: "🔵",
  },
  [ChainId.Optimism]: {
    name: "Optimism",
    shortName: "OP",
    bgClass: "bg-red-100 dark:bg-red-900/40",
    textClass: "text-red-600 dark:text-red-300",
    icon: "🔴",
  },
  [ChainId.Polygon]: {
    name: "Polygon",
    shortName: "POL",
    bgClass: "bg-purple-100 dark:bg-purple-900/40",
    textClass: "text-purple-700 dark:text-purple-300",
    icon: "🟣",
  },
  [ChainId.Base]: {
    name: "Base",
    shortName: "BASE",
    bgClass: "bg-blue-100 dark:bg-blue-900/40",
    textClass: "text-blue-600 dark:text-blue-300",
    icon: "🔷",
  },
};

const SIZE_CLASSES: Record<NonNullable<ChainBadgeProps["size"]>, string> = {
  xs: "px-1.5 py-0.5 text-[10px] gap-0.5",
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-2.5 py-1 text-sm gap-1",
  lg: "px-3 py-1.5 text-base gap-1.5",
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays a colour-coded badge for the given EVM chain.
 */
export const ChainBadge: React.FC<ChainBadgeProps> = ({
  chainId,
  size = "sm",
  className,
  showIcon = true,
}) => {
  const meta = CHAIN_META[chainId] ?? {
    name: `Chain ${chainId}`,
    shortName: String(chainId),
    bgClass: "bg-gray-100 dark:bg-gray-800",
    textClass: "text-gray-600 dark:text-gray-400",
    icon: "🔗",
  };

  return (
    <span
      role="status"
      aria-label={`Connected to ${meta.name}`}
      className={cn(
        "inline-flex items-center rounded-full font-medium leading-none",
        SIZE_CLASSES[size],
        meta.bgClass,
        meta.textClass,
        className,
      )}
    >
      {showIcon && (
        <span aria-hidden="true" className="leading-none">
          {meta.icon}
        </span>
      )}
      <span>{meta.shortName}</span>
    </span>
  );
};

ChainBadge.displayName = "ChainBadge";
