/**
 * SessionManager — persists and restores wallet sessions.
 *
 * Stores session data (address, chainId, JWT, expiry) in `localStorage` (or
 * `sessionStorage` for ephemeral sessions) so that page refreshes don't force
 * the user to reconnect from scratch.
 *
 * Also generates Sign-In with Ethereum (SIWE) messages for the auth flow.
 *
 * @example
 * ```ts
 * const session = new SessionManager(client);
 * const saved  = session.load();
 * if (saved && !session.isExpired(saved)) {
 *   await connector.connect(saved.walletType);
 * }
 * ```
 */

import type { ChainId } from "@sw3/shared-types";
import { WalletType } from "@sw3/shared-types";
import { SESSION_TTL_MS } from "@sw3/config";
import { AuthError, SdkErrorCode } from "../core/errors.js";
import type { SweeperClient } from "../core/client.js";

// ─── Session shape ────────────────────────────────────────────────────────────

export interface WalletSession {
  /** Connected wallet address. */
  address: `0x${string}`;
  /** Chain the session was created on. */
  chainId: ChainId;
  /** Wallet type used for this session. */
  walletType: WalletType;
  /**
   * JWT access token returned by the Sw3 API after SIWE verification.
   * `null` if the user hasn't completed the SIWE auth flow.
   */
  jwt: string | null;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Unix timestamp (ms) after which the session is considered expired. */
  expiresAt: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface SessionManagerConfig {
  /** Where to persist the session. Defaults to `"local"`. */
  storage?: "local" | "session";
  /** Override the TTL in ms. Defaults to {@link SESSION_TTL_MS}. */
  ttlMs?: number;
  /** Storage key prefix. Defaults to `"sw3_session"`. */
  storageKey?: string;
}

// ─── Manager ──────────────────────────────────────────────────────────────────

export class SessionManager {
  private readonly client: SweeperClient;
  private readonly storageKey: string;
  private readonly ttlMs: number;
  private readonly storageType: "local" | "session";

  constructor(client: SweeperClient, config: SessionManagerConfig = {}) {
    this.client = client;
    this.storageKey = config.storageKey ?? "sw3_session";
    this.ttlMs = config.ttlMs ?? SESSION_TTL_MS;
    this.storageType = config.storage ?? "local";
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Saves the session to browser storage.
   * No-ops in non-browser environments.
   */
  save(session: WalletSession): void {
    const store = this.getStorage();
    if (!store) return;
    store.setItem(this.storageKey, JSON.stringify(session));
    this.client.log("session saved", {
      address: session.address,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  }

  /**
   * Loads and returns the stored session, or `null` if none exists.
   */
  load(): WalletSession | null {
    const store = this.getStorage();
    if (!store) return null;
    const raw = store.getItem(this.storageKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as WalletSession;
    } catch {
      this.clear();
      return null;
    }
  }

  /** Removes the session from browser storage. */
  clear(): void {
    this.getStorage()?.removeItem(this.storageKey);
  }

  // ─── Session helpers ───────────────────────────────────────────────────────

  /** Returns `true` if the session has passed its `expiresAt` timestamp. */
  isExpired(session: WalletSession): boolean {
    return Date.now() > session.expiresAt;
  }

  /**
   * Creates a fresh session object (not yet persisted).
   * Call `save()` after creating the SIWE JWT to persist it.
   */
  create(
    address: `0x${string}`,
    chainId: ChainId,
    walletType: WalletType,
  ): WalletSession {
    return {
      address,
      chainId,
      walletType,
      jwt: null,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + this.ttlMs,
    };
  }

  /**
   * Updates the JWT on an existing session and refreshes the expiry.
   *
   * @throws {AuthError} if the session has already expired.
   */
  setJwt(session: WalletSession, jwt: string): WalletSession {
    if (this.isExpired(session)) {
      throw new AuthError(
        "Cannot set JWT on an expired session",
        SdkErrorCode.SessionExpired,
      );
    }
    const updated: WalletSession = {
      ...session,
      jwt,
      expiresAt: Date.now() + this.ttlMs,
    };
    this.save(updated);
    return updated;
  }

  /**
   * Extends the session TTL by another `ttlMs` milliseconds.
   * Call this after a successful API interaction to keep the session alive.
   *
   * @throws {AuthError} if the session has already expired.
   */
  refresh(session: WalletSession): WalletSession {
    if (this.isExpired(session)) {
      throw new AuthError(
        "Cannot refresh an expired session",
        SdkErrorCode.SessionExpired,
      );
    }
    const refreshed: WalletSession = {
      ...session,
      expiresAt: Date.now() + this.ttlMs,
    };
    this.save(refreshed);
    return refreshed;
  }

  // ─── SIWE message generation ───────────────────────────────────────────────

  /**
   * Generates a SIWE-compliant (EIP-4361) message for the given session.
   *
   * @param nonce - Random server-issued nonce from the `/auth/nonce` endpoint.
   * @param domain - Requesting domain (e.g. "app.sw3.io").
   * @param uri - Full URI of the resource being accessed.
   */
  buildSiweMessage(params: {
    address: `0x${string}`;
    chainId: ChainId;
    nonce: string;
    domain: string;
    uri: string;
    statement?: string;
    issuedAt?: string;
    expirationTime?: string;
  }): string {
    const {
      address,
      chainId,
      nonce,
      domain,
      uri,
      statement = "Sign in to Sw3 to access your sweep dashboard.",
      issuedAt = new Date().toISOString(),
      expirationTime,
    } = params;

    const lines = [
      `${domain} wants you to sign in with your Ethereum account:`,
      address,
      "",
      statement,
      "",
      `URI: ${uri}`,
      "Version: 1",
      `Chain ID: ${chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
    ];

    if (expirationTime) {
      lines.push(`Expiration Time: ${expirationTime}`);
    }

    return lines.join("\n");
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private getStorage(): Storage | null {
    if (typeof window === "undefined") return null;
    return this.storageType === "local"
      ? window.localStorage
      : window.sessionStorage;
  }
}
