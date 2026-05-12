/**
 * WalletButton — connection state button with address display and menu.
 *
 * States:
 *  - Disconnected: renders a "Connect Wallet" call-to-action.
 *  - Connecting: renders a spinner.
 *  - Connected: renders the truncated address, a chain badge, and a dropdown
 *    with "Copy address" and "Disconnect".
 *
 * @example
 * ```tsx
 * <WalletButton
 *   wallet={connectedWallet}
 *   onConnect={() => connector.connect(WalletType.MetaMask)}
 *   onDisconnect={() => connector.disconnect()}
 * />
 * ```
 */

"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDownIcon,
  CopyIcon,
  LogOutIcon,
  WalletIcon,
  CheckIcon,
  Loader2Icon,
} from "lucide-react";
import type { ConnectedWallet } from "@sw3/shared-types";
import { cn } from "../lib/utils.js";
import { ChainBadge } from "./ChainBadge.js";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WalletButtonProps {
  /** Currently connected wallet, or `null` / `undefined` if disconnected. */
  wallet?: ConnectedWallet | null;
  /** Whether a connection is in progress. */
  isConnecting?: boolean;
  /** Called when the user clicks "Connect Wallet". */
  onConnect: () => void;
  /** Called when the user selects "Disconnect" from the dropdown. */
  onDisconnect: () => void;
  /** Optional click handler to open a chain-switching modal. */
  onSwitchChain?: () => void;
  /** Additional CSS classes applied to the root button element. */
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Wallet connection button with integrated status display and action menu.
 */
export const WalletButton: React.FC<WalletButtonProps> = ({
  wallet,
  isConnecting = false,
  onConnect,
  onDisconnect,
  onSwitchChain,
  className,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    if (!wallet?.address) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [wallet?.address]);

  // ── Disconnected state ──────────────────────────────────────────────────────
  if (!wallet) {
    return (
      <button
        type="button"
        onClick={onConnect}
        disabled={isConnecting}
        aria-label="Connect wallet"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold",
          "bg-indigo-600 text-white shadow-sm",
          "hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2",
          "focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "transition-colors duration-150",
          className,
        )}
      >
        {isConnecting ? (
          <>
            <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Connecting…</span>
          </>
        ) : (
          <>
            <WalletIcon className="h-4 w-4" aria-hidden="true" />
            <span>Connect Wallet</span>
          </>
        )}
      </button>
    );
  }

  // ── Connected state ─────────────────────────────────────────────────────────
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Wallet connected: ${wallet.address}`}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium",
            "bg-white dark:bg-gray-900",
            "border border-gray-200 dark:border-gray-700",
            "shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500",
            "transition-colors duration-150",
            className,
          )}
        >
          {/* Chain badge */}
          <ChainBadge chainId={wallet.chainId} size="xs" />

          {/* Truncated address */}
          <span className="font-mono text-gray-800 dark:text-gray-200">
            {truncateAddress(wallet.address)}
          </span>

          <ChevronDownIcon
            className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[180px] overflow-hidden rounded-lg border",
            "border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-900",
            "animate-in fade-in-0 zoom-in-95 data-[side=top]:slide-in-from-bottom-2",
            "data-[side=bottom]:slide-in-from-top-2",
          )}
        >
          {/* Full address (non-interactive) */}
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
              Address
            </p>
            <p className="font-mono text-xs text-gray-700 dark:text-gray-300 break-all">
              {wallet.address}
            </p>
          </div>

          {/* Copy address */}
          <DropdownMenu.Item
            onSelect={handleCopy}
            className={cn(
              "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
              "text-gray-700 dark:text-gray-200",
              "hover:bg-gray-50 dark:hover:bg-gray-800 focus:bg-gray-50",
              "dark:focus:bg-gray-800 focus:outline-none",
              "transition-colors duration-100",
            )}
          >
            {copied ? (
              <CheckIcon className="h-4 w-4 text-green-500" aria-hidden="true" />
            ) : (
              <CopyIcon className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copied!" : "Copy address"}
          </DropdownMenu.Item>

          {/* Switch chain */}
          {onSwitchChain && (
            <DropdownMenu.Item
              onSelect={onSwitchChain}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                "text-gray-700 dark:text-gray-200",
                "hover:bg-gray-50 dark:hover:bg-gray-800 focus:bg-gray-50",
                "dark:focus:bg-gray-800 focus:outline-none",
                "transition-colors duration-100",
              )}
            >
              <ChainBadge chainId={wallet.chainId} size="xs" showIcon />
              Switch network
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Separator className="my-1 h-px bg-gray-100 dark:bg-gray-800" />

          {/* Disconnect */}
          <DropdownMenu.Item
            onSelect={onDisconnect}
            className={cn(
              "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
              "text-red-600 dark:text-red-400",
              "hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50",
              "dark:focus:bg-red-900/20 focus:outline-none",
              "transition-colors duration-100",
            )}
          >
            <LogOutIcon className="h-4 w-4" aria-hidden="true" />
            Disconnect
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

WalletButton.displayName = "WalletButton";
