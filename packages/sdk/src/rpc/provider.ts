/**
 * RpcProvider — multi-endpoint JSON-RPC provider with automatic failover.
 *
 * Manages a pool of RPC endpoints for a single chain.  On each request it
 * picks the "healthiest" endpoint (lowest error count), and falls back to the
 * next endpoint when one returns an error.  Periodic health-check pings keep
 * the internal health map up-to-date.
 *
 * @example
 * ```ts
 * const provider = new RpcProvider({
 *   urls: ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth"],
 *   chainId: ChainId.Mainnet,
 * });
 *
 * const blockNumber = await provider.request("eth_blockNumber", []);
 * ```
 */

import { createPublicClient, http, type PublicClient } from "viem";
import { CHAIN_CONFIGS } from "@sw3/config";
import type { ChainId } from "@sw3/shared-types";
import { AllRpcsExhaustedError, NetworkError, errOpts } from "../core/errors.js";
import { RetryManager } from "./retry.js";

// ─── Health state ─────────────────────────────────────────────────────────────

interface EndpointHealth {
  url: string;
  /** Cumulative error count since process start. */
  errorCount: number;
  /** Whether the endpoint failed its last health-check ping. */
  isDown: boolean;
  /** Timestamp of the last successful response. */
  lastSuccessAt: number;
  /** Timestamp of the last failure. */
  lastFailureAt: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface RpcProviderConfig {
  /** Ordered list of RPC endpoint URLs. */
  urls: string[];
  chainId: ChainId;
  /** Interval between health-check pings in ms. Defaults to 30 000. */
  healthCheckIntervalMs?: number;
  /** Timeout for a single RPC request in ms. Defaults to 15 000. */
  requestTimeoutMs?: number;
  /** Retry config for individual RPC calls. */
  retryConfig?: ConstructorParameters<typeof RetryManager>[0];
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class RpcProvider {
  private readonly urls: string[];
  private readonly chainId: ChainId;
  private readonly healthCheckIntervalMs: number;
  private readonly requestTimeoutMs: number;
  private readonly health: Map<string, EndpointHealth>;
  private readonly retry: RetryManager;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RpcProviderConfig) {
    if (config.urls.length === 0) {
      throw new NetworkError("RpcProvider requires at least one URL");
    }
    this.urls = [...config.urls];
    this.chainId = config.chainId;
    this.healthCheckIntervalMs = config.healthCheckIntervalMs ?? 30_000;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 15_000;
    this.retry = new RetryManager(config.retryConfig ?? { maxAttempts: 3 });

    this.health = new Map(
      this.urls.map((url) => [
        url,
        {
          url,
          errorCount: 0,
          isDown: false,
          lastSuccessAt: Date.now(),
          lastFailureAt: 0,
        },
      ]),
    );

    this.startHealthChecks();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Creates a viem `PublicClient` backed by the healthiest endpoint.
   * Call this instead of caching the client to benefit from automatic failover.
   */
  getPublicClient(): PublicClient {
    const url = this.pickEndpoint();
    const chainCfg = CHAIN_CONFIGS[this.chainId];
    if (!chainCfg) throw new NetworkError(`Unknown chain ${this.chainId}`);

    return createPublicClient({
      chain: {
        id: chainCfg.id,
        name: chainCfg.name,
        nativeCurrency: chainCfg.nativeCurrency,
        rpcUrls: {
          default: { http: [url] },
          public: { http: [url] },
        },
        blockExplorers: {
          default: { name: chainCfg.name, url: chainCfg.blockExplorer },
        },
      },
      transport: http(url, { timeout: this.requestTimeoutMs }),
    });
  }

  /**
   * Executes a raw JSON-RPC request against the healthiest endpoint,
   * falling back to the next on failure.
   */
  async request<T = unknown>(
    method: string,
    params: unknown[] = [],
  ): Promise<T> {
    const sorted = this.sortedEndpoints();
    const errors: Error[] = [];

    for (const endpoint of sorted) {
      try {
        const result = await this.retry.execute(() =>
          this.rawRequest<T>(endpoint.url, method, params),
        );
        this.markSuccess(endpoint.url);
        return result;
      } catch (err: unknown) {
        this.markFailure(endpoint.url);
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    const lastErr = errors[errors.length - 1];
    throw new AllRpcsExhaustedError(sorted.map((e) => e.url), errOpts(lastErr));
  }

  /** Returns health information for all managed endpoints. */
  getHealth(): EndpointHealth[] {
    return [...this.health.values()];
  }

  /** Stops the background health-check timer. Call when tearing down. */
  destroy(): void {
    if (this.healthCheckTimer !== null) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private pickEndpoint(): string {
    const best = this.sortedEndpoints()[0];
    if (!best) throw new AllRpcsExhaustedError(this.urls);
    return best.url;
  }

  private sortedEndpoints(): EndpointHealth[] {
    return [...this.health.values()].sort((a, b) => {
      // Up endpoints come before down ones
      if (a.isDown !== b.isDown) return a.isDown ? 1 : -1;
      // Within the same state, prefer fewer errors
      return a.errorCount - b.errorCount;
    });
  }

  private markSuccess(url: string): void {
    const h = this.health.get(url);
    if (h) {
      h.isDown = false;
      h.lastSuccessAt = Date.now();
    }
  }

  private markFailure(url: string): void {
    const h = this.health.get(url);
    if (h) {
      h.errorCount++;
      h.isDown = true;
      h.lastFailureAt = Date.now();
    }
  }

  private async rawRequest<T>(
    url: string,
    method: string,
    params: unknown[],
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.requestTimeoutMs,
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status} from ${url}: ${response.statusText}`,
        );
      }

      const json = (await response.json()) as {
        result?: T;
        error?: { code: number; message: string };
      };

      if (json.error) {
        throw new NetworkError(
          `JSON-RPC error ${json.error.code}: ${json.error.message}`,
          { context: { url, method, rpcCode: json.error.code } },
        );
      }

      return json.result as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      await Promise.allSettled(
        this.urls.map(async (url) => {
          try {
            await this.rawRequest(url, "eth_blockNumber", []);
            this.markSuccess(url);
          } catch {
            this.markFailure(url);
          }
        }),
      );
    }, this.healthCheckIntervalMs);
  }
}
