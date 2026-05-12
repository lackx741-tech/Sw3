/**
 * Analytics types for the Sw3 platform.
 *
 * Used by the SDK's `AnalyticsTracker`, the indexer service, and the
 * analytics dashboard to record and display platform metrics.
 */

import type { ChainId } from "./chain.js";

// ─── Events ───────────────────────────────────────────────────────────────────

/**
 * Discriminated union of all trackable analytics events.
 * The `name` field acts as the discriminant.
 */
export type AnalyticsEvent =
  | WalletConnectEvent
  | WalletDisconnectEvent
  | SweepInitiatedEvent
  | SweepCompletedEvent
  | SweepFailedEvent
  | PermitSignedEvent
  | PageViewEvent
  | ErrorEvent;

/** Base fields present on every analytics event. */
interface BaseEvent {
  /** ISO-8601 timestamp when the event was generated client-side. */
  timestamp: string;
  /** Anonymous session identifier (UUID). */
  sessionId: string;
  /** Anonymous user identifier (UUID, persisted in localStorage). */
  userId: string;
  /** SDK or app version string, e.g. "0.1.0". */
  version: string;
}

export interface WalletConnectEvent extends BaseEvent {
  name: "wallet_connected";
  properties: {
    walletType: string;
    chainId: ChainId;
  };
}

export interface WalletDisconnectEvent extends BaseEvent {
  name: "wallet_disconnected";
  properties: {
    walletType: string;
    sessionDurationMs: number;
  };
}

export interface SweepInitiatedEvent extends BaseEvent {
  name: "sweep_initiated";
  properties: {
    chainId: ChainId;
    legCount: number;
    /** Total estimated USD value of the batch. */
    estimatedUsdValue: string;
    usePermit2: boolean;
  };
}

export interface SweepCompletedEvent extends BaseEvent {
  name: "sweep_completed";
  properties: {
    chainId: ChainId;
    sweepId: string;
    txHash: string;
    durationMs: number;
    gasUsed: string;
    totalUsdValue: string;
    feePaidUsd: string;
  };
}

export interface SweepFailedEvent extends BaseEvent {
  name: "sweep_failed";
  properties: {
    chainId: ChainId;
    sweepId: string;
    errorCode: string;
    durationMs: number;
  };
}

export interface PermitSignedEvent extends BaseEvent {
  name: "permit_signed";
  properties: {
    chainId: ChainId;
    tokenCount: number;
    permitType: "single" | "batch" | "transfer_from";
  };
}

export interface PageViewEvent extends BaseEvent {
  name: "page_view";
  properties: {
    path: string;
    referrer: string | null;
    title: string;
  };
}

export interface ErrorEvent extends BaseEvent {
  name: "error";
  properties: {
    errorCode: string;
    message: string;
    stack?: string;
    context?: string;
  };
}

// ─── Metric snapshots ─────────────────────────────────────────────────────────

/**
 * A point-in-time platform metric snapshot, used to build time-series charts.
 */
export interface MetricSnapshot {
  /** ISO-8601 timestamp for the start of the aggregation window. */
  windowStart: string;
  /** Duration of the window in seconds (e.g. 3600 for hourly). */
  windowSec: number;
  chainId: ChainId | null;
  /** Metric name, e.g. "sweep_count", "total_volume_usd". */
  metric: string;
  /** Numeric value of the metric. */
  value: number;
}

// ─── Volume stats ─────────────────────────────────────────────────────────────

/** Aggregated volume statistics over a time range. */
export interface VolumeStats {
  chainId: ChainId | null;
  /** ISO-8601 start of the period. */
  from: string;
  /** ISO-8601 end of the period. */
  to: string;
  /** Total USD swept over the period. */
  totalVolumeUsd: string;
  /** Total platform fees collected in USD. */
  totalFeesUsd: string;
  /** Number of distinct wallet addresses that swept. */
  uniqueWallets: number;
  /** Total number of completed sweep transactions. */
  sweepCount: number;
  /** Total number of token legs swept. */
  legCount: number;
}

// ─── Sweep stats ─────────────────────────────────────────────────────────────

/** Sweep-specific statistics for a single wallet or the entire platform. */
export interface SweepStats {
  /** Wallet address, or `null` for platform-wide stats. */
  address: `0x${string}` | null;
  chainId: ChainId | null;
  /** Total number of sweeps initiated. */
  totalSweeps: number;
  /** Number of sweeps that reached "finalised" status. */
  successfulSweeps: number;
  /** Number of sweeps that reached "failed" status. */
  failedSweeps: number;
  /** Success rate in percent, 0–100. */
  successRate: number;
  /** Total USD volume swept (successful only). */
  totalVolumeUsd: string;
  /** Average USD value per sweep. */
  avgSweepUsd: string;
  /** Largest single sweep in USD. */
  maxSweepUsd: string;
  /** ISO-8601 timestamp of the first sweep. */
  firstSweepAt: string | null;
  /** ISO-8601 timestamp of the most recent sweep. */
  lastSweepAt: string | null;
}
