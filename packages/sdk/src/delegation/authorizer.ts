/**
 * Authorizer — builds and signs EIP-7702-style delegated execution authorizations.
 *
 * The `Authorizer` constructs a `DelegationAuthorization` struct, serialises it
 * into EIP-712 typed data, and asks the connected wallet to sign it.  The
 * resulting signature is consumed by `DelegatedExecutorClient.execute`.
 *
 * @example
 * ```ts
 * const authorizer = new Authorizer(client, delegatedExecutorAddress);
 *
 * const { authorization, signature } = await authorizer.sign({
 *   nonce: 0n,
 *   deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
 *   calls: [
 *     { target: "0xabc…", value: 0n, data: "0x" },
 *   ],
 * });
 * ```
 */

import { type WalletClient } from "viem";
import {
  AUTHORIZATION_TYPES,
  type DelegatedCall,
  type DelegationAuthorization,
} from "@sw3/shared-types";
import { SdkErrorCode, ValidationError, WalletError, errOpts } from "../core/errors.js";
import type { SweeperClient } from "../core/client.js";

// ─── Parameter types ──────────────────────────────────────────────────────────

export interface SignAuthorizationParams {
  /**
   * Per-signer nonce. Use `Authorizer.fetchNonce` to obtain the next unused
   * nonce, or supply one explicitly for non-sequential usage.
   */
  nonce: bigint;
  /**
   * Unix timestamp (seconds) after which the authorization is invalid.
   * Defaults to `now + 5 minutes`.
   */
  deadline?: bigint;
  /** Ordered list of calls the relayer will execute on behalf of the signer. */
  calls: DelegatedCall[];
}

export interface SignedAuthorization {
  /** The fully populated authorization struct. */
  authorization: DelegationAuthorization;
  /** 65-byte ECDSA signature over the EIP-712 digest. */
  signature: `0x${string}`;
}

// ─── Authorizer ───────────────────────────────────────────────────────────────

export class Authorizer {
  private readonly client: SweeperClient;
  private readonly contractAddress: `0x${string}`;

  /**
   * @param client           SweeperClient instance (wallet must be connected).
   * @param contractAddress  Deployed `DelegatedExecutor` address on the target chain.
   */
  constructor(client: SweeperClient, contractAddress: `0x${string}`) {
    this.client = client;
    this.contractAddress = contractAddress;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Builds the `DelegationAuthorization` struct, constructs EIP-712 typed data,
   * and requests the connected wallet to sign it.
   *
   * @throws {WalletError} if no wallet is connected.
   * @throws {ValidationError} if the call list is empty or contains a zero target.
   * @throws {WalletError} if the user rejects the signature.
   */
  async sign(params: SignAuthorizationParams): Promise<SignedAuthorization> {
    const walletClient = this.client.getWalletClient();
    const [address] = await walletClient.getAddresses();
    if (!address) {
      throw new WalletError(
        "No accounts available — connect a wallet first",
        SdkErrorCode.WalletNotConnected,
      );
    }

    this.validateCalls(params.calls);

    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = params.deadline ?? now + 300n;

    const authorization: DelegationAuthorization = {
      signer:   address,
      nonce:    params.nonce,
      deadline,
      calls:    params.calls,
    };

    const signature = await this.signTypedData(walletClient, address, authorization);

    return { authorization, signature };
  }

  /**
   * Reads the on-chain nonce bitmap to find the next **unused** nonce for the
   * connected account, starting from `hint` (default 0).
   *
   * The contract packs 256 nonces into a single storage word.  We read words
   * sequentially until we find an unset bit.
   *
   * @param hint Optional starting nonce to scan from.
   */
  async fetchNextNonce(hint = 0n): Promise<bigint> {
    const publicClient = this.client.getPublicClient();
    const walletClient = this.client.getWalletClient();
    const [address] = await walletClient.getAddresses();
    if (!address) {
      throw new WalletError(
        "No accounts available",
        SdkErrorCode.WalletNotConnected,
      );
    }

    const NONCE_BITMAP_ABI = [
      {
        type: "function",
        name: "isNonceUsed",
        stateMutability: "view",
        inputs: [
          { name: "signer", type: "address" },
          { name: "nonce",  type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
      },
    ] as const;

    // Scan linearly from `hint`. In practice callers track nonces client-side;
    // this is a fallback read path.
    let candidate = hint;
    for (let i = 0; i < 512; i++) {
      const used = await publicClient.readContract({
        address: this.contractAddress,
        abi: NONCE_BITMAP_ABI,
        functionName: "isNonceUsed",
        args: [address, candidate],
      });
      if (!used) return candidate;
      candidate++;
    }

    throw new ValidationError(
      `Could not find an unused nonce within 512 slots starting at ${hint}`,
      SdkErrorCode.InvalidAmount,
    );
  }

  // ─── Typed data builders ───────────────────────────────────────────────────

  /**
   * Builds the EIP-712 typed data structure for a `DelegationAuthorization`.
   * Public so that off-chain tooling can inspect or verify the payload.
   */
  buildTypedData(authorization: DelegationAuthorization) {
    return {
      domain: {
        name:              "DelegatedExecutor" as const,
        version:           "1" as const,
        chainId:           this.client.config.chainId,
        verifyingContract: this.contractAddress,
      },
      types: AUTHORIZATION_TYPES,
      primaryType: "Authorization" as const,
      message: {
        signer:   authorization.signer,
        nonce:    authorization.nonce,
        deadline: authorization.deadline,
        calls:    authorization.calls.map((c) => ({
          target: c.target,
          value:  c.value,
          data:   c.data,
        })),
      },
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private validateCalls(calls: DelegatedCall[]): void {
    if (calls.length === 0) {
      throw new ValidationError(
        "Authorization must contain at least one call",
        SdkErrorCode.InvalidArgument,
        { field: "calls" },
      );
    }
    for (const [i, call] of calls.entries()) {
      if (!call.target || call.target === "0x0000000000000000000000000000000000000000") {
        throw new ValidationError(
          `Call at index ${i} has a zero target address`,
          SdkErrorCode.InvalidAddress,
          { field: `calls[${i}].target` },
        );
      }
    }
  }

  private async signTypedData(
    walletClient: WalletClient,
    address: `0x${string}`,
    authorization: DelegationAuthorization,
  ): Promise<`0x${string}`> {
    const typedData = this.buildTypedData(authorization);
    try {
      return await walletClient.signTypedData({
        account:     address,
        domain:      typedData.domain as Parameters<typeof walletClient.signTypedData>[0]["domain"],
        types:       typedData.types  as Parameters<typeof walletClient.signTypedData>[0]["types"],
        primaryType: typedData.primaryType,
        message:     typedData.message,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRejection =
        msg.toLowerCase().includes("user rejected") ||
        (err as { code?: number }).code === 4001;

      throw new WalletError(
        isRejection ? "User rejected the authorization signature" : msg,
        isRejection ? SdkErrorCode.WalletRejected : SdkErrorCode.SignatureFailed,
        errOpts(err),
      );
    }
  }
}
