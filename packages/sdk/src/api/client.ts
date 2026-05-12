/**
 * TypedApiClient — typed HTTP client for the Sw3 REST API.
 *
 * Provides strongly-typed methods for every API endpoint, handling:
 *  - Auth headers (`Authorization: Bearer <jwt>`)
 *  - Request/response serialisation
 *  - Error normalisation into {@link SweeperError} sub-classes
 *  - Pagination helpers
 *
 * @example
 * ```ts
 * const api = new TypedApiClient({
 *   baseUrl: "https://api.sw3.io",
 *   apiKey: "sk_live_...",
 * });
 *
 * const history = await api.getSweepHistory({ address: "0x..." });
 * ```
 */

import type {
  ApiResponse,
  PaginatedResponse,
  SweepRequest,
  SweepResult,
  TokenWithBalance,
  VolumeStats,
} from "@sw3/shared-types";
import { ErrorCode } from "@sw3/shared-types";
import type { ChainId } from "@sw3/shared-types";
import {
  AuthError,
  NetworkError,
  RateLimitError,
  SdkErrorCode,
  SweeperError,
  ValidationError,
  errOpts,
} from "../core/errors.js";
import { API_VERSION } from "@sw3/config";

// ─── Client config ────────────────────────────────────────────────────────────

export interface ApiClientConfig {
  baseUrl: string;
  /** Bearer JWT or API key for authenticated requests. */
  apiKey?: string;
  /** Request timeout in ms. Defaults to 30 000. */
  timeoutMs?: number;
  /** Additional headers sent on every request. */
  defaultHeaders?: Record<string, string>;
}

// ─── Query param types ────────────────────────────────────────────────────────

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface SweepHistoryParams extends PaginationParams {
  address: `0x${string}`;
  chainId?: ChainId;
  status?: string;
}

export interface QuoteParams {
  chainId: ChainId;
  tokenAddress: `0x${string}`;
  amount: string;
  feeBps: number;
}

export interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
}

// ─── TypedApiClient ───────────────────────────────────────────────────────────

export class TypedApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private jwt: string | null = null;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      "X-API-Version": API_VERSION,
      ...(config.apiKey
        ? { Authorization: `Bearer ${config.apiKey}` }
        : {}),
      ...config.defaultHeaders,
    };
  }

  /** Sets the JWT used for authenticated requests. */
  setJwt(jwt: string | null): void {
    this.jwt = jwt;
  }

  // ─── Sweep endpoints ───────────────────────────────────────────────────────

  /** Lists sweep history for a wallet address. */
  async getSweepHistory(
    params: SweepHistoryParams,
  ): Promise<PaginatedResponse<SweepResult>> {
    const qs = new URLSearchParams({
      address: params.address,
      ...(params.chainId !== undefined
        ? { chainId: String(params.chainId) }
        : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
      limit: String(params.limit ?? 20),
    });
    return this.get<PaginatedResponse<SweepResult>>(
      `/sweeps?${qs.toString()}`,
    );
  }

  /** Retrieves a single sweep result by ID. */
  async getSweep(sweepId: string): Promise<SweepResult> {
    return this.get<SweepResult>(`/sweeps/${sweepId}`);
  }

  /** Creates a new sweep job on the server. */
  async createSweepJob(request: SweepRequest): Promise<SweepResult> {
    return this.post<SweepResult>("/sweeps", request);
  }

  /** Returns a price/fee quote for a sweep leg. */
  async getQuote(
    params: QuoteParams,
  ): Promise<{ netAmount: string; feeAmount: string; feeBps: number }> {
    const qs = new URLSearchParams({
      chainId: String(params.chainId),
      token: params.tokenAddress,
      amount: params.amount,
      feeBps: String(params.feeBps),
    });
    return this.get<{ netAmount: string; feeAmount: string; feeBps: number }>(
      `/sweeps/quote?${qs.toString()}`,
    );
  }

  // ─── Token endpoints ───────────────────────────────────────────────────────

  /**
   * Returns the ERC-20 token balances for a wallet on a given chain.
   */
  async getTokenBalances(
    address: `0x${string}`,
    chainId: ChainId,
  ): Promise<TokenWithBalance[]> {
    return this.get<TokenWithBalance[]>(
      `/tokens/balances?address=${address}&chainId=${chainId}`,
    );
  }

  // ─── Webhook endpoints ─────────────────────────────────────────────────────

  /** Lists registered webhooks for the authenticated account. */
  async getWebhooks(): Promise<PaginatedResponse<WebhookConfig & { id: string }>> {
    return this.get<PaginatedResponse<WebhookConfig & { id: string }>>(
      "/webhooks",
    );
  }

  /** Registers a new webhook. */
  async createWebhook(
    config: WebhookConfig,
  ): Promise<WebhookConfig & { id: string }> {
    return this.post<WebhookConfig & { id: string }>("/webhooks", config);
  }

  /** Deletes a registered webhook by ID. */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.delete(`/webhooks/${webhookId}`);
  }

  // ─── Analytics endpoints ───────────────────────────────────────────────────

  /** Returns aggregated volume statistics. */
  async getVolumeStats(
    chainId?: ChainId,
    from?: string,
    to?: string,
  ): Promise<VolumeStats> {
    const qs = new URLSearchParams({
      ...(chainId !== undefined ? { chainId: String(chainId) } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    return this.get<VolumeStats>(`/analytics/volume?${qs.toString()}`);
  }

  // ─── Auth endpoints ────────────────────────────────────────────────────────

  /** Fetches a SIWE nonce for the given address. */
  async getNonce(address: `0x${string}`): Promise<string> {
    const data = await this.post<{ nonce: string }>("/auth/nonce", {
      address,
    });
    return data.nonce;
  }

  /** Verifies a SIWE signature and returns a JWT. */
  async verifySignature(params: {
    message: string;
    signature: `0x${string}`;
    address: `0x${string}`;
  }): Promise<string> {
    const data = await this.post<{ token: string }>("/auth/verify", params);
    return data.token;
  }

  /** Logs out and invalidates the current JWT. */
  async logout(): Promise<void> {
    await this.post<void>("/auth/logout", {});
    this.jwt = null;
  }

  // ─── HTTP helpers ──────────────────────────────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async delete(path: string): Promise<void> {
    await this.request<void>("DELETE", path);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(this.jwt ? { Authorization: `Bearer ${this.jwt}` } : {}),
    };

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      const raw = await response.json() as ApiResponse<T>;

      if (!response.ok || !raw.success) {
        this.throwApiError(response.status, raw.success ? undefined : raw.error);
      }

      return (raw as Extract<typeof raw, { success: true }>).data;
    } catch (err: unknown) {
      if (err instanceof SweeperError) throw err;
      if ((err as { name?: string }).name === "AbortError") {
        throw new NetworkError(`Request to ${path} timed out after ${this.timeoutMs}ms`);
      }
      throw new NetworkError(
        err instanceof Error ? err.message : String(err),
        errOpts(err),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private throwApiError(
    status: number,
    apiError?: { code: ErrorCode; message: string },
  ): never {
    const code = apiError?.code;
    const message = apiError?.message ?? `HTTP ${status}`;

    if (status === 429 || code === ErrorCode.TooManyRequests) {
      throw new RateLimitError(message);
    }
    if (status === 401 || status === 403) {
      throw new AuthError(
        message,
        status === 401 ? SdkErrorCode.Unauthorized : SdkErrorCode.Unauthorized,
      );
    }
    if (status === 422 || code === ErrorCode.InvalidAddress) {
      throw new ValidationError(message, SdkErrorCode.InvalidArgument);
    }
    throw new NetworkError(message, {
      context: { status, apiErrorCode: code },
    });
  }
}
