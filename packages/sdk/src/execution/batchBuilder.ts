/**
 * BatchBuilder — assembles validated sweep batches ready for on-chain execution.
 *
 * The builder follows a fluent API:
 *
 * ```ts
 * const batch = await new BatchBuilder(client)
 *   .addSweepLeg({ token, from, to, amount, feeBps })
 *   .addPermitSweepLeg({ token, from, to, amount, feeBps, signature, nonce, deadline })
 *   .build();
 * ```
 *
 * `build()` validates limits, encodes the calldata, and returns a
 * {@link SweepBatch} ready to be passed to {@link Executor.execute}.
 */

import { encodeFunctionData } from "viem";
import {
  MAX_BATCH_SIZE,
  MAX_FEE_BPS,
  DEFAULT_DEADLINE_SECONDS,
  BPS_DENOMINATOR,
} from "@sw3/config";
import type {
  SweepBatch,
  SweepLeg,
  PermitSweepLeg,
  Token,
} from "@sw3/shared-types";
import {
  SdkErrorCode,
  ValidationError,
  ContractError,
} from "../core/errors.js";
import type { SweeperClient } from "../core/client.js";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface AddSweepLegInput {
  token: Token;
  from: `0x${string}`;
  to: `0x${string}`;
  /** Raw amount (smallest token unit). */
  amount: bigint;
  /** Fee in basis points (0–1000). */
  feeBps: number;
}

export interface AddPermitSweepLegInput extends AddSweepLegInput {
  signature: `0x${string}`;
  nonce: bigint;
  deadline: bigint;
}

// ─── Sweeper ABI (minimal) ────────────────────────────────────────────────────

const SWEEPER_ABI = [
  {
    type: "function",
    name: "sweep",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "legs",
        type: "tuple[]",
        components: [
          { name: "token", type: "address" },
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "feeBps", type: "uint16" },
        ],
      },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "sweepWithPermit",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "legs",
        type: "tuple[]",
        components: [
          { name: "token", type: "address" },
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "feeBps", type: "uint16" },
          { name: "signature", type: "bytes" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

// ─── BatchBuilder ─────────────────────────────────────────────────────────────

export class BatchBuilder {
  private readonly client: SweeperClient;
  private readonly legs: Array<SweepLeg | PermitSweepLeg> = [];
  private _deadlineSeconds = DEFAULT_DEADLINE_SECONDS;

  constructor(client: SweeperClient) {
    this.client = client;
  }

  // ─── Builder methods ───────────────────────────────────────────────────────

  /**
   * Adds a standard sweep leg (requires prior ERC-20 approval or Permit2
   * allowance set separately).
   */
  addSweepLeg(input: AddSweepLegInput): this {
    this.validateLegInput(input);
    const { feeAmount, netAmount } = this.computeFees(
      input.amount,
      input.feeBps,
    );
    this.legs.push({
      token: input.token,
      from: input.from,
      to: input.to,
      amount: input.amount,
      feeBps: input.feeBps,
      feeAmount,
      netAmount,
    });
    return this;
  }

  /**
   * Adds a sweep leg that uses a Permit2 signature for gasless approval.
   */
  addPermitSweepLeg(input: AddPermitSweepLegInput): this {
    this.validateLegInput(input);
    const { feeAmount, netAmount } = this.computeFees(
      input.amount,
      input.feeBps,
    );
    this.legs.push({
      token: input.token,
      from: input.from,
      to: input.to,
      amount: input.amount,
      feeBps: input.feeBps,
      feeAmount,
      netAmount,
      signature: input.signature,
      nonce: input.nonce,
      deadline: input.deadline,
    } satisfies PermitSweepLeg);
    return this;
  }

  /** Override the batch deadline (seconds from now). */
  setDeadline(seconds: number): this {
    if (seconds <= 0 || seconds > 86_400) {
      throw new ValidationError(
        "Deadline must be between 1 and 86400 seconds",
        SdkErrorCode.DeadlineExceeded,
        { field: "deadline" },
      );
    }
    this._deadlineSeconds = seconds;
    return this;
  }

  // ─── Build / estimate / validate ──────────────────────────────────────────

  /**
   * Validates the current leg list and returns basic statistics without
   * building the full batch object.
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.legs.length === 0) {
      errors.push("Batch must contain at least one sweep leg");
    }
    if (this.legs.length > MAX_BATCH_SIZE) {
      errors.push(
        `Batch exceeds maximum size of ${MAX_BATCH_SIZE} legs (got ${this.legs.length})`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Estimates the total gas for the batch by simulating the call via viem.
   * Returns `null` if the simulation fails (caller should check).
   */
  async estimate(): Promise<bigint | null> {
    const sweeperAddress =
      this.client.config.contractAddresses.sweeper;
    if (!sweeperAddress) return null;

    const { calldata } = this.buildCalldata();

    try {
      const publicClient = this.client.getPublicClient();
      const gas = await publicClient.estimateGas({
        to: sweeperAddress,
        data: calldata,
        account:
          this.client.getConnectedWallet()?.address ??
          "0x0000000000000000000000000000000000000001",
      });
      return gas;
    } catch {
      return null;
    }
  }

  /**
   * Validates the batch and returns a {@link SweepBatch} ready for execution.
   *
   * @throws {ValidationError} if the batch is invalid.
   * @throws {ContractError} if the sweeper contract is not deployed on this chain.
   */
  async build(): Promise<SweepBatch> {
    const { valid, errors } = this.validate();
    if (!valid) {
      throw new ValidationError(errors.join("; "), SdkErrorCode.BatchTooLarge);
    }

    const sweeperAddress = this.client.config.contractAddresses.sweeper;
    if (!sweeperAddress) {
      throw new ContractError(
        `Sweeper contract is not deployed on chain ${this.client.config.chainId}`,
        SdkErrorCode.ContractNotDeployed,
      );
    }

    const { calldata, deadline } = this.buildCalldata();
    const estimatedGas = (await this.estimate()) ?? 500_000n;

    const batch: SweepBatch = {
      id: crypto.randomUUID(),
      chainId: this.client.config.chainId,
      legs: [...this.legs],
      estimatedGas,
      calldata,
      deadline,
      createdAt: new Date().toISOString(),
    };

    return batch;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private buildCalldata(): {
    calldata: `0x${string}`;
    deadline: number;
  } {
    const deadline = Math.floor(Date.now() / 1000) + this._deadlineSeconds;
    const hasPermitLegs = this.legs.some((l) => "signature" in l);

    const functionName = hasPermitLegs ? "sweepWithPermit" : "sweep";

    const encodedLegs = hasPermitLegs
      ? this.legs.map((l) => ({
          token: l.token.address,
          from: l.from,
          to: l.to,
          amount: l.amount,
          feeBps: l.feeBps,
          signature: (l as PermitSweepLeg).signature ?? "0x",
          nonce: (l as PermitSweepLeg).nonce ?? 0n,
          deadline: (l as PermitSweepLeg).deadline ?? BigInt(deadline),
        }))
      : this.legs.map((l) => ({
          token: l.token.address,
          from: l.from,
          to: l.to,
          amount: l.amount,
          feeBps: l.feeBps,
        }));

    const calldata = encodeFunctionData({
      abi: SWEEPER_ABI,
      functionName,
      args: [encodedLegs as never[], BigInt(deadline)],
    });

    return { calldata, deadline };
  }

  private validateLegInput(input: AddSweepLegInput): void {
    if (this.legs.length >= MAX_BATCH_SIZE) {
      throw new ValidationError(
        `Cannot add more than ${MAX_BATCH_SIZE} legs to a batch`,
        SdkErrorCode.BatchTooLarge,
      );
    }
    if (input.feeBps < 0 || input.feeBps > MAX_FEE_BPS) {
      throw new ValidationError(
        `feeBps must be between 0 and ${MAX_FEE_BPS}, got ${input.feeBps}`,
        SdkErrorCode.InvalidAmount,
        { field: "feeBps" },
      );
    }
    if (input.amount <= 0n) {
      throw new ValidationError(
        "Sweep amount must be greater than zero",
        SdkErrorCode.InvalidAmount,
        { field: "amount" },
      );
    }
    if (!input.from.startsWith("0x") || input.from.length !== 42) {
      throw new ValidationError(
        `Invalid 'from' address: ${input.from}`,
        SdkErrorCode.InvalidAddress,
        { field: "from" },
      );
    }
    if (!input.to.startsWith("0x") || input.to.length !== 42) {
      throw new ValidationError(
        `Invalid 'to' address: ${input.to}`,
        SdkErrorCode.InvalidAddress,
        { field: "to" },
      );
    }
  }

  private computeFees(
    amount: bigint,
    feeBps: number,
  ): { feeAmount: bigint; netAmount: bigint } {
    const feeAmount = (amount * BigInt(feeBps)) / BigInt(BPS_DENOMINATOR);
    const netAmount = amount - feeAmount;
    return { feeAmount, netAmount };
  }
}
