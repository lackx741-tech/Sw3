/**
 * AnalyticsTracker — client-side analytics event tracking with batching.
 *
 * Events are buffered in memory and flushed to the Sw3 analytics endpoint
 * either when the buffer is full or on a periodic flush interval.
 *
 * @example
 * ```ts
 * const tracker = new AnalyticsTracker(client, {
 *   endpoint: "https://api.sw3.io/analytics",
 *   batchSize: 20,
 *   flushIntervalMs: 10_000,
 * });
 *
 * tracker.trackEvent({ name: "page_view", properties: { path: "/" } });
 * ```
 */

import type { AnalyticsEvent, SweepResult } from "@sw3/shared-types";
import {
  ANALYTICS_BATCH_SIZE,
  ANALYTICS_FLUSH_INTERVAL_MS,
} from "@sw3/config";
import type { SweeperClient } from "../core/client.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface AnalyticsTrackerConfig {
  /** Analytics ingest endpoint URL. */
  endpoint?: string;
  /** Number of events to buffer before auto-flushing. */
  batchSize?: number;
  /** Max time between flushes in ms. */
  flushIntervalMs?: number;
  /** Anonymous user ID seed (persisted in localStorage). */
  userId?: string;
  /** SDK / app version. */
  version?: string;
  /** Set to `false` to disable tracking entirely. */
  enabled?: boolean;
}

// ─── Tracker ──────────────────────────────────────────────────────────────────

export class AnalyticsTracker {
  private readonly client: SweeperClient;
  private readonly endpoint: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly userId: string;
  private readonly version: string;
  private readonly enabled: boolean;
  private readonly sessionId: string;
  private readonly queue: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(client: SweeperClient, config: AnalyticsTrackerConfig = {}) {
    this.client = client;
    this.endpoint =
      config.endpoint ?? `${client.config.apiUrl}/analytics/events`;
    this.batchSize = config.batchSize ?? ANALYTICS_BATCH_SIZE;
    this.flushIntervalMs = config.flushIntervalMs ?? ANALYTICS_FLUSH_INTERVAL_MS;
    this.userId = config.userId ?? this.getOrCreateUserId();
    this.version = config.version ?? "0.1.0";
    this.enabled = config.enabled ?? true;
    this.sessionId = crypto.randomUUID();

    if (this.enabled) {
      this.startFlushTimer();
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Queues an analytics event.
   *
   * The event is enriched with `timestamp`, `sessionId`, `userId`, and
   * `version` before being added to the buffer.
   */
  trackEvent(event: Omit<AnalyticsEvent, "timestamp" | "sessionId" | "userId" | "version">): void {
    if (!this.enabled) return;

    const enriched = {
      ...event,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      version: this.version,
    } as AnalyticsEvent;

    this.queue.push(enriched);

    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }

  /**
   * Convenience: tracks a `sweep_completed` event from a {@link SweepResult}.
   */
  trackSweep(
    result: SweepResult,
    extra: { durationMs: number; totalUsdValue: string; feePaidUsd: string },
  ): void {
    if (!result.txHash) return;
    this.trackEvent({
      name: "sweep_completed",
      properties: {
        chainId: this.client.config.chainId,
        sweepId: result.id,
        txHash: result.txHash,
        durationMs: extra.durationMs,
        gasUsed: result.gasUsed?.toString() ?? "0",
        totalUsdValue: extra.totalUsdValue,
        feePaidUsd: extra.feePaidUsd,
      },
    });
  }

  /**
   * Convenience: tracks a `wallet_connected` event.
   */
  trackWalletConnect(walletType: string): void {
    this.trackEvent({
      name: "wallet_connected",
      properties: {
        walletType,
        chainId: this.client.config.chainId,
      },
    });
  }

  /**
   * Flushes the event queue to the analytics endpoint immediately.
   * Events that fail to send are dropped (best-effort analytics).
   */
  async flush(): Promise<void> {
    if (!this.enabled || this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);
    this.client.log(`Flushing ${batch.length} analytics events`);

    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.client.config.apiKey
            ? { Authorization: `Bearer ${this.client.config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({ events: batch }),
        // Use keepalive so events sent during page unload are not dropped.
        keepalive: true,
      });
    } catch (err: unknown) {
      // Analytics failures are silently swallowed — we don't want tracking
      // errors to affect application behaviour.
      this.client.log("Analytics flush failed:", err);
    }
  }

  /** Flushes remaining events and stops the background timer. */
  async destroy(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private getOrCreateUserId(): string {
    if (typeof window === "undefined") return crypto.randomUUID();
    const key = "sw3_uid";
    let id = window.localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(key, id);
    }
    return id;
  }
}
