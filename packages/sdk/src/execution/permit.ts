/**
 * PermitSigner — EIP-712 Permit2 signature utilities.
 *
 * Builds typed data structures and requests the user's wallet to sign Permit2
 * `AllowanceTransfer` and `SignatureTransfer` permits.
 *
 * @example
 * ```ts
 * const signer = new PermitSigner(client);
 *
 * // Single permit
 * const { signature, nonce } = await signer.signPermit2Single({
 *   token: "0xA0b86991...",
 *   spender: sweeperAddress,
 *   amount: parseUnits("1000", 6),
 *   deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
 * });
 * ```
 */

import { type WalletClient } from "viem";
import {
  PERMIT_BATCH_TYPES,
  PERMIT_SINGLE_TYPES,
  PERMIT_TRANSFER_FROM_TYPES,
  type PermitBatch,
  type PermitDetails,
  type PermitSingle,
  type PermitTransferFrom,
  type TokenPermissions,
} from "@sw3/shared-types";
import { PERMIT2_ADDRESS } from "@sw3/config";
import { ContractError, SdkErrorCode, WalletError, errOpts } from "../core/errors.js";
import type { SweeperClient } from "../core/client.js";

// ─── Parameter types ──────────────────────────────────────────────────────────

export interface SignPermit2SingleParams {
  /** ERC-20 token to approve. */
  token: `0x${string}`;
  /** Address authorised to spend (typically the sweeper contract). */
  spender: `0x${string}`;
  /** Maximum amount (raw, in token's smallest unit). */
  amount: bigint;
  /**
   * Unix timestamp (seconds) after which the permit itself expires.
   * Defaults to `now + 5 minutes`.
   */
  deadline?: bigint;
  /**
   * Unix timestamp (seconds) of the allowance expiration.
   * Defaults to `now + 1 hour`.
   */
  expiration?: number;
  /** Permit nonce override. If omitted, fetched from the contract. */
  nonce?: number;
}

export interface SignPermit2BatchParams {
  /** List of tokens and amounts to approve. */
  permits: Array<Omit<SignPermit2SingleParams, "deadline">>;
  /** Shared spender address for all permits in the batch. */
  spender: `0x${string}`;
  /** Unix timestamp (seconds) after which the permit batch expires. */
  deadline?: bigint;
}

export interface SignedPermit {
  /** The 65-byte ECDSA signature. */
  signature: `0x${string}`;
  /** Nonce used for the permit. */
  nonce: number | bigint;
  /** Deadline used for the permit. */
  deadline: bigint;
}

// ─── PermitSigner ─────────────────────────────────────────────────────────────

export class PermitSigner {
  private readonly client: SweeperClient;

  constructor(client: SweeperClient) {
    this.client = client;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Signs a single-token Permit2 `AllowanceTransfer` permit.
   */
  async signPermit2Single(
    params: SignPermit2SingleParams,
  ): Promise<SignedPermit> {
    const walletClient = this.client.getWalletClient();
    const [address] = await walletClient.getAddresses();
    if (!address) {
      throw new WalletError("No accounts available", SdkErrorCode.WalletNotConnected);
    }

    const now = Math.floor(Date.now() / 1000);
    const deadline = params.deadline ?? BigInt(now + 300);
    const expiration = params.expiration ?? now + 3_600;
    const nonce = params.nonce ?? (await this.getPermitNonce(params.token, address, params.spender));

    const permitSingle: PermitSingle = {
      details: {
        token: params.token,
        amount: params.amount,
        expiration,
        nonce,
      },
      spender: params.spender,
      sigDeadline: deadline,
    };

    const typedData = this.buildSingleTypedData(permitSingle);
    const signature = await this.signTypedData(walletClient, address, typedData);

    return { signature, nonce, deadline };
  }

  /**
   * Signs a multi-token Permit2 `AllowanceTransfer` batch permit.
   */
  async signPermit2Batch(
    params: SignPermit2BatchParams,
  ): Promise<SignedPermit> {
    const walletClient = this.client.getWalletClient();
    const [address] = await walletClient.getAddresses();
    if (!address) {
      throw new WalletError("No accounts available", SdkErrorCode.WalletNotConnected);
    }

    const now = Math.floor(Date.now() / 1000);
    const deadline = params.deadline ?? BigInt(now + 300);

    const details: PermitDetails[] = await Promise.all(
      params.permits.map(async (p) => {
        const nonce =
          p.nonce ??
          (await this.getPermitNonce(p.token, address, params.spender));
        return {
          token: p.token,
          amount: p.amount,
          expiration: p.expiration ?? now + 3_600,
          nonce,
        };
      }),
    );

    const permitBatch: PermitBatch = {
      details,
      spender: params.spender,
      sigDeadline: deadline,
    };

    const typedData = this.buildBatchTypedData(permitBatch);
    const signature = await this.signTypedData(walletClient, address, typedData);

    return { signature, nonce: 0, deadline };
  }

  /**
   * Signs a single-use `SignatureTransfer` permit (no stored allowance).
   */
  async signPermitTransferFrom(params: {
    permitted: TokenPermissions;
    spender: `0x${string}`;
    nonce?: bigint;
    deadline?: bigint;
  }): Promise<SignedPermit> {
    const walletClient = this.client.getWalletClient();
    const [address] = await walletClient.getAddresses();
    if (!address) {
      throw new WalletError("No accounts available", SdkErrorCode.WalletNotConnected);
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = params.deadline ?? now + 300n;
    const nonce = params.nonce ?? BigInt(Date.now()); // timestamp-based nonce

    const permit: PermitTransferFrom = {
      permitted: params.permitted,
      spender: params.spender,
      nonce,
      deadline,
    };

    const typedData = this.buildTransferFromTypedData(permit);
    const signature = await this.signTypedData(walletClient, address, typedData);

    return { signature, nonce, deadline };
  }

  /**
   * Reads the current Permit2 nonce for a given owner/token/spender triple.
   *
   * @returns The current nonce as a number (safe to use in permits).
   */
  async getPermitNonce(
    token: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`,
  ): Promise<number> {
    const publicClient = this.client.getPublicClient();
    try {
      const [, , nonce] = (await publicClient.readContract({
        address: PERMIT2_ADDRESS,
        abi: [
          {
            type: "function",
            name: "allowance",
            stateMutability: "view",
            inputs: [
              { name: "owner", type: "address" },
              { name: "token", type: "address" },
              { name: "spender", type: "address" },
            ],
            outputs: [
              { name: "amount", type: "uint160" },
              { name: "expiration", type: "uint48" },
              { name: "nonce", type: "uint48" },
            ],
          },
        ] as const,
        functionName: "allowance",
        args: [owner, token, spender],
      })) as [bigint, number, number];
      return nonce;
    } catch (err: unknown) {
      throw new ContractError(
        `Failed to read Permit2 nonce for token ${token}`,
        SdkErrorCode.ContractCallFailed,
        errOpts(err),
      );
    }
  }

  // ─── Typed data builders ───────────────────────────────────────────────────

  /** Builds the EIP-712 typed data for a `PermitSingle`. */
  buildSingleTypedData(permit: PermitSingle) {
    return {
      domain: {
        name: "Permit2" as const,
        chainId: this.client.config.chainId,
        verifyingContract: PERMIT2_ADDRESS,
      },
      types: PERMIT_SINGLE_TYPES,
      primaryType: "PermitSingle" as const,
      message: {
        details: {
          token: permit.details.token,
          amount: permit.details.amount,
          expiration: permit.details.expiration,
          nonce: permit.details.nonce,
        },
        spender: permit.spender,
        sigDeadline: permit.sigDeadline,
      },
    };
  }

  /** Builds the EIP-712 typed data for a `PermitBatch`. */
  buildBatchTypedData(permit: PermitBatch) {
    return {
      domain: {
        name: "Permit2" as const,
        chainId: this.client.config.chainId,
        verifyingContract: PERMIT2_ADDRESS,
      },
      types: PERMIT_BATCH_TYPES,
      primaryType: "PermitBatch" as const,
      message: {
        details: permit.details,
        spender: permit.spender,
        sigDeadline: permit.sigDeadline,
      },
    };
  }

  /** Builds the EIP-712 typed data for a `PermitTransferFrom`. */
  buildTransferFromTypedData(permit: PermitTransferFrom) {
    return {
      domain: {
        name: "Permit2" as const,
        chainId: this.client.config.chainId,
        verifyingContract: PERMIT2_ADDRESS,
      },
      types: PERMIT_TRANSFER_FROM_TYPES,
      primaryType: "PermitTransferFrom" as const,
      message: {
        permitted: permit.permitted,
        spender: permit.spender,
        nonce: permit.nonce,
        deadline: permit.deadline,
      },
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async signTypedData(
    walletClient: WalletClient,
    address: `0x${string}`,
    typedData: {
      domain: Readonly<Record<string, unknown>>;
      types: Readonly<Record<string, ReadonlyArray<Readonly<{ name: string; type: string }>>>>;
      primaryType: string;
      message: Readonly<Record<string, unknown>>;
    },
  ): Promise<`0x${string}`> {
    try {
      return await walletClient.signTypedData({
        account: address,
        domain: typedData.domain as Parameters<typeof walletClient.signTypedData>[0]["domain"],
        types: typedData.types as Parameters<typeof walletClient.signTypedData>[0]["types"],
        primaryType: typedData.primaryType,
        message: typedData.message,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRejection =
        msg.toLowerCase().includes("user rejected") ||
        (err as { code?: number }).code === 4001;

      throw new WalletError(
        isRejection ? "User rejected the permit signature" : msg,
        isRejection ? SdkErrorCode.WalletRejected : SdkErrorCode.SignatureFailed,
        errOpts(err),
      );
    }
  }
}
