/**
 * SiweAuth — Sign-In with Ethereum (EIP-4361) authentication module.
 *
 * Handles the full SIWE flow:
 *  1. Fetch a nonce from the Sw3 API (`/auth/nonce`).
 *  2. Build a SIWE message via `SessionManager`.
 *  3. Request the user's wallet to sign the message.
 *  4. Verify the signature with the Sw3 API (`/auth/verify`), receiving a JWT.
 *  5. Persist the session via `SessionManager`.
 *
 * @example
 * ```ts
 * const auth = new SiweAuth(client, session);
 * const { jwt, session: s } = await auth.signIn({
 *   domain: "app.sw3.io",
 *   uri: "https://app.sw3.io",
 * });
 * ```
 */

import { verifyMessage } from "viem";
import type { ChainId } from "@sw3/shared-types";
import { AuthError, SdkErrorCode, WalletError, errOpts } from "../core/errors.js";
import type { SweeperClient } from "../core/client.js";
import type { SessionManager, WalletSession } from "../wallet/session.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignInParams {
  /** The hostname of the dapp requesting sign-in. */
  domain: string;
  /** Full URI of the page requesting sign-in. */
  uri: string;
  /** Optional custom statement shown in the wallet. */
  statement?: string;
  /** Override the default session TTL for this sign-in, in seconds. */
  expirySeconds?: number;
}

export interface SignInResult {
  /** Signed JWT from the Sw3 API. */
  jwt: string;
  /** Populated session ready to be used with API calls. */
  session: WalletSession;
  /** The raw SIWE message that was signed. */
  message: string;
  /** The 65-byte ECDSA signature. */
  signature: `0x${string}`;
}

// ─── SiweAuth ─────────────────────────────────────────────────────────────────

export class SiweAuth {
  private readonly client: SweeperClient;
  private readonly sessionManager: SessionManager;

  constructor(client: SweeperClient, sessionManager: SessionManager) {
    this.client = client;
    this.sessionManager = sessionManager;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Runs the full SIWE sign-in flow.
   *
   * Prerequisites:
   *  - A wallet must be connected (`client.getConnectedWallet()` !== null).
   *  - The wallet client must support `signMessage`.
   *
   * @throws {WalletError} if the wallet is not connected or the user rejects.
   * @throws {AuthError} if the server-side verification fails.
   */
  async signIn(params: SignInParams): Promise<SignInResult> {
    const wallet = this.client.getConnectedWallet();
    if (!wallet) {
      throw new WalletError(
        "Cannot sign in — no wallet connected",
        SdkErrorCode.WalletNotConnected,
      );
    }

    // 1. Fetch a server-issued nonce
    const nonce = await this.fetchNonce(wallet.address);

    // 2. Build the SIWE message
    const expirationTime = params.expirySeconds
      ? new Date(Date.now() + params.expirySeconds * 1000).toISOString()
      : undefined;

    const message = this.sessionManager.buildSiweMessage({
      address: wallet.address,
      chainId: wallet.chainId,
      nonce,
      domain: params.domain,
      uri: params.uri,
      ...(params.statement !== undefined ? { statement: params.statement } : {}),
      ...(expirationTime !== undefined ? { expirationTime } : {}),
    });

    // 3. Sign the message with the user's wallet
    const signature = await this.signMessage(message);

    // 4. Verify with the API and obtain a JWT
    const jwt = await this.verifyWithApi({
      message,
      signature,
      address: wallet.address,
      chainId: wallet.chainId,
    });

    // 5. Persist the session
    let session = this.sessionManager.create(
      wallet.address,
      wallet.chainId,
      wallet.type,
    );
    session = this.sessionManager.setJwt(session, jwt);

    return { jwt, session, message, signature };
  }

  /**
   * Verifies a SIWE signature locally using viem (no network call).
   *
   * Useful for server-side route handlers that receive the message + signature
   * from the client.
   */
  async verify(params: {
    message: string;
    signature: `0x${string}`;
    expectedAddress: `0x${string}`;
  }): Promise<boolean> {
    try {
      const recovered = await verifyMessage({
        address: params.expectedAddress,
        message: params.message,
        signature: params.signature,
      });
      return recovered;
    } catch {
      return false;
    }
  }

  /**
   * Signs out by clearing the local session.
   * Does not revoke the JWT server-side — callers should call the API's
   * `/auth/logout` endpoint separately if needed.
   */
  signOut(): void {
    this.sessionManager.clear();
    this.client.emit("sessionExpired", { reason: "manual" });
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async fetchNonce(address: `0x${string}`): Promise<string> {
    const apiUrl = this.client.config.apiUrl;
    const response = await fetch(`${apiUrl}/auth/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });

    if (!response.ok) {
      throw new AuthError(
        `Failed to fetch SIWE nonce: HTTP ${response.status}`,
        SdkErrorCode.Unauthorized,
      );
    }

    const data = (await response.json()) as { nonce: string };
    return data.nonce;
  }

  private async signMessage(message: string): Promise<`0x${string}`> {
    const walletClient = this.client.getWalletClient();
    const [address] = await walletClient.getAddresses();

    try {
      return await walletClient.signMessage({ account: address!, message });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRejection =
        msg.toLowerCase().includes("user rejected") ||
        (err as { code?: number }).code === 4001;

      throw new WalletError(
        isRejection ? "User rejected the signature request" : msg,
        isRejection ? SdkErrorCode.WalletRejected : SdkErrorCode.SignatureFailed,
        errOpts(err),
      );
    }
  }

  private async verifyWithApi(params: {
    message: string;
    signature: `0x${string}`;
    address: `0x${string}`;
    chainId: ChainId;
  }): Promise<string> {
    const apiUrl = this.client.config.apiUrl;
    const response = await fetch(`${apiUrl}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new AuthError(
        `SIWE verification failed: HTTP ${response.status} — ${text}`,
        SdkErrorCode.SiweVerificationFailed,
      );
    }

    const data = (await response.json()) as { token: string };
    if (!data.token) {
      throw new AuthError(
        "SIWE verification succeeded but no JWT was returned",
        SdkErrorCode.SiweVerificationFailed,
      );
    }
    return data.token;
  }
}
