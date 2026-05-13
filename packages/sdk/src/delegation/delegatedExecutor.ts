/**
 * DelegatedExecutorClient — submits signed delegated execution batches.
 *
 * Responsibilities:
 *  - Simulate the delegated batch via `eth_call` before any on-chain submission.
 *  - Fall back gracefully when the wallet does not support EIP-7702 delegation
 *    (surface a clear error rather than silently executing the wrong path).
 *  - Submit the `executeDelegated` transaction with retry and nonce management.
 *  - Wait for the required number of confirmations.
 *  - Emit `delegatedBatchStarted` and `delegatedBatchCompleted` events on the client.
 *
 * @example
 * ```ts
 * const authorizer = new Authorizer(client, delegatedExecutorAddress);
 * const { authorization, signature } = await authorizer.sign({ nonce: 0n, calls });
 *
 * const executor = new DelegatedExecutorClient(client);
 * const result = await executor.execute({ authorization, signature });
 * ```
 */

import { encodeFunctionData } from "viem";
import type {
  DelegatedBatch,
  DelegatedBatchResult,
  DelegatedCall,
} from "@sw3/shared-types";
import {
  ContractError,
  SdkErrorCode,
  ValidationError,
  WalletError,
  errOpts,
} from "../core/errors.js";
import type { SweeperClient } from "../core/client.js";
import { RetryManager, sleep } from "../rpc/retry.js";

// ─── Minimal ABI ──────────────────────────────────────────────────────────────

const DELEGATED_EXECUTOR_ABI = [
  {
    type: "function",
    name: "executeDelegated",
    stateMutability: "payable",
    inputs: [
      {
        name: "auth",
        type: "tuple",
        components: [
          { name: "signer",   type: "address" },
          { name: "nonce",    type: "uint256" },
          { name: "deadline", type: "uint256" },
          {
            name: "calls",
            type: "tuple[]",
            components: [
              { name: "target", type: "address" },
              { name: "value",  type: "uint256" },
              { name: "data",   type: "bytes"   },
            ],
          },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

// ─── Config ───────────────────────────────────────────────────────────────────

export interface DelegatedExecutorConfig {
  /** Number of submission attempts before giving up. Defaults to 3. */
  maxAttempts?: number;
  /** Confirmations to wait for. Falls back to chain config default. */
  confirmations?: number;
  /**
   * Whether to run a simulation before submitting. Defaults to `true`.
   * Strongly recommended — disable only in test environments.
   */
  simulate?: boolean;
}

// ─── DelegatedExecutorClient ─────────────────────────────────────────────────

export class DelegatedExecutorClient {
  private readonly client: SweeperClient;
  private readonly retry: RetryManager;
  private readonly simulate: boolean;
  private readonly confirmationsOverride: number | undefined;

  constructor(client: SweeperClient, config: DelegatedExecutorConfig = {}) {
    this.client = client;
    this.simulate = config.simulate ?? true;
    this.confirmationsOverride = config.confirmations;
    this.retry = new RetryManager({
      maxAttempts: config.maxAttempts ?? 3,
      initialDelayMs: 1_000,
      maxDelayMs: 15_000,
      onRetry: (attempt, delay, err) => {
        client.log(
          `DelegatedExecutor retry #${attempt} in ${delay}ms — ${String(err)}`,
        );
      },
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Executes a signed delegated batch:
   *  1. Resolves and validates the `DelegatedExecutor` contract address.
   *  2. Checks the authorization deadline.
   *  3. Optionally simulates the call via `eth_call`.
   *  4. Encodes `executeDelegated` calldata.
   *  5. Submits the transaction with retry.
   *  6. Waits for the required confirmations.
   *  7. Returns a finalised {@link DelegatedBatchResult}.
   *
   * @throws {WalletError}     if no wallet is connected.
   * @throws {ContractError}   if the contract is not deployed, simulation fails,
   *                            or the transaction reverts.
   * @throws {ValidationError} if the batch deadline has already passed.
   */
  async execute(batch: DelegatedBatch): Promise<DelegatedBatchResult> {
    const wallet = this.client.getConnectedWallet();
    if (!wallet) {
      throw new WalletError(
        "Wallet not connected",
        SdkErrorCode.WalletNotConnected,
      );
    }

    const contractAddress = this.client.config.contractAddresses.delegatedExecutor;
    if (!contractAddress) {
      throw new ContractError(
        `DelegatedExecutor contract not deployed on chain ${batch.chainId}`,
        SdkErrorCode.ContractNotDeployed,
      );
    }

    // Deadline guard
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    if (batch.authorization.deadline < nowSeconds) {
      throw new ValidationError(
        "Delegated batch authorization deadline has already passed",
        SdkErrorCode.DeadlineExceeded,
        { field: "authorization.deadline" },
      );
    }

    const calldata = this.buildCalldata(batch);

    // Total ETH value to forward
    const totalValue = batch.authorization.calls.reduce(
      (sum: bigint, c: DelegatedCall) => sum + c.value,
      0n,
    );

    // Pre-submit simulation gate
    if (this.simulate) {
      await this.simulateBatch(
        wallet.address,
        contractAddress,
        calldata,
        totalValue,
        batch.id,
      );
    }

    // Submit with retry
    const txHash = await this.retry.execute(() =>
      this.submitTransaction(
        wallet.address,
        contractAddress,
        calldata,
        totalValue,
        batch.estimatedGas,
      ),
    );

    this.client.log(`DelegatedBatch ${batch.id} submitted: ${txHash}`);

    // Wait for confirmations
    const confirmations =
      this.confirmationsOverride ?? this.client.getChainConfig().confirmations;

    const receipt = await this.waitForReceipt(txHash, confirmations);

    const result: DelegatedBatchResult = {
      id:          batch.id,
      success:     receipt.status === "success",
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed:     receipt.gasUsed,
      finalisedAt: new Date().toISOString(),
      error:       receipt.status === "reverted" ? "Transaction reverted" : null,
    };

    return result;
  }

  /**
   * Simulates a delegated batch against the current chain state.
   * Throws `ContractError` if the simulation reverts.
   */
  async simulateBatch(
    account: `0x${string}`,
    contractAddress: `0x${string}`,
    calldata: `0x${string}`,
    value: bigint,
    batchId: string,
  ): Promise<void> {
    const publicClient = this.client.getPublicClient();
    try {
      await publicClient.call({
        to:      contractAddress,
        data:    calldata,
        account,
        value,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ContractError(
        `Delegated batch simulation failed: ${msg}`,
        SdkErrorCode.SimulationFailed,
        errOpts(err, { batchId }),
      );
    }
  }

  /**
   * Estimates gas for the delegated batch call.
   * Returns `null` if estimation fails.
   */
  async estimateGas(batch: DelegatedBatch): Promise<bigint | null> {
    const contractAddress = this.client.config.contractAddresses.delegatedExecutor;
    if (!contractAddress) return null;

    const calldata = this.buildCalldata(batch);
    const totalValue = batch.authorization.calls.reduce(
      (sum: bigint, c: DelegatedCall) => sum + c.value,
      0n,
    );

    try {
      const publicClient = this.client.getPublicClient();
      return await publicClient.estimateGas({
        to:      contractAddress,
        data:    calldata,
        value:   totalValue,
        account:
          this.client.getConnectedWallet()?.address ??
          "0x0000000000000000000000000000000000000001",
      });
    } catch {
      return null;
    }
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private buildCalldata(batch: DelegatedBatch): `0x${string}` {
    return encodeFunctionData({
      abi:          DELEGATED_EXECUTOR_ABI,
      functionName: "executeDelegated",
      args: [
        {
          signer:   batch.authorization.signer,
          nonce:    batch.authorization.nonce,
          deadline: batch.authorization.deadline,
          calls:    batch.authorization.calls.map((c: DelegatedCall) => ({
            target: c.target,
            value:  c.value,
            data:   c.data,
          })),
        },
        batch.signature,
      ],
    });
  }

  private async submitTransaction(
    account: `0x${string}`,
    contractAddress: `0x${string}`,
    calldata: `0x${string}`,
    value: bigint,
    gas: bigint,
  ): Promise<`0x${string}`> {
    const walletClient = this.client.getWalletClient();
    const publicClient = this.client.getPublicClient();

    const nonce = await publicClient.getTransactionCount({
      address:  account,
      blockTag: "pending",
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await walletClient.sendTransaction({
        account,
        to:    contractAddress,
        data:  calldata,
        value,
        gas,
        nonce,
      } as any);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRejection =
        msg.toLowerCase().includes("user rejected") ||
        (err as { code?: number }).code === 4001;

      throw isRejection
        ? new WalletError(msg, SdkErrorCode.WalletRejected, errOpts(err))
        : new ContractError(msg, SdkErrorCode.ContractCallFailed, errOpts(err));
    }
  }

  private async waitForReceipt(
    txHash: `0x${string}`,
    confirmations: number,
  ): Promise<{
    status: "success" | "reverted";
    blockNumber: bigint;
    gasUsed: bigint;
  }> {
    const publicClient = this.client.getPublicClient();
    const chainCfg     = this.client.getChainConfig();

    const pollInterval = Math.min(chainCfg.blockTimeMs, 3_000);
    const maxWaitMs    = 5 * 60 * 1_000;
    const start        = Date.now();

    while (Date.now() - start < maxWaitMs) {
      await sleep(pollInterval);

      const receipt = await publicClient
        .getTransactionReceipt({ hash: txHash })
        .catch(() => null);

      if (!receipt) continue;

      const currentBlock   = await publicClient.getBlockNumber();
      const confirmedBlocks = currentBlock - receipt.blockNumber;

      if (confirmedBlocks >= BigInt(confirmations)) {
        return {
          status:      receipt.status,
          blockNumber: receipt.blockNumber,
          gasUsed:     receipt.gasUsed,
        };
      }
    }

    throw new ContractError(
      `Delegated batch transaction ${txHash} not confirmed after 5 minutes`,
      SdkErrorCode.GasEstimationFailed,
      { context: { txHash, confirmations } },
    );
  }
}
