/**
 * Executor — submits and tracks sweep batches on-chain.
 *
 * Responsibilities:
 *  - Manage nonces to avoid stuck transactions.
 *  - Simulate batches before submission to surface reverts early.
 *  - Submit the transaction and wait for the required number of confirmations.
 *  - Retry failed submissions with exponential backoff (up to 3 attempts).
 *  - Emit `sweepStarted`, `sweepCompleted`, and `sweepFailed` events on the client.
 *
 * @example
 * ```ts
 * const executor = new Executor(client);
 * const result = await executor.execute(batch);
 * console.log(result.txHash);
 * ```
 */

import type { SweepBatch, SweepResult } from "@sw3/shared-types";
import { SweepStatus } from "@sw3/shared-types";
import { ContractError, SdkErrorCode, WalletError, errOpts } from "../core/errors.js";
import type { SweeperClient } from "../core/client.js";
import { RetryManager, sleep } from "../rpc/retry.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface ExecutorConfig {
  /** Number of submission attempts before giving up. Defaults to 3. */
  maxAttempts?: number;
  /** Confirmations to wait for. Falls back to chain config default. */
  confirmations?: number;
  /** Whether to run a simulation before submitting. Defaults to `true`. */
  simulate?: boolean;
}

// ─── Executor ─────────────────────────────────────────────────────────────────

export class Executor {
  private readonly client: SweeperClient;
  private readonly retry: RetryManager;
  private readonly simulate: boolean;
  private readonly confirmationsOverride: number | undefined;

  constructor(client: SweeperClient, config: ExecutorConfig = {}) {
    this.client = client;
    this.simulate = config.simulate ?? true;
    this.confirmationsOverride = config.confirmations;
    this.retry = new RetryManager({
      maxAttempts: config.maxAttempts ?? 3,
      initialDelayMs: 1_000,
      maxDelayMs: 15_000,
      onRetry: (attempt, delay, err) => {
        client.log(
          `Executor retry #${attempt} in ${delay}ms — ${String(err)}`,
        );
      },
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Executes a sweep batch:
   *  1. Optionally simulates the call.
   *  2. Submits the transaction with retry.
   *  3. Waits for the required confirmations.
   *  4. Returns a finalised {@link SweepResult}.
   *
   * @throws {WalletError} if the wallet is not connected.
   * @throws {ContractError} if simulation or the transaction fails.
   */
  async execute(batch: SweepBatch): Promise<SweepResult> {
    const wallet = this.client.getConnectedWallet();
    if (!wallet) {
      throw new WalletError("Wallet not connected", SdkErrorCode.WalletNotConnected);
    }

    const sweeperAddress = this.client.config.contractAddresses.sweeper;
    if (!sweeperAddress) {
      throw new ContractError(
        `Sweeper contract not deployed on chain ${batch.chainId}`,
        SdkErrorCode.ContractNotDeployed,
      );
    }

    // Validate deadline
    if (batch.deadline < Math.floor(Date.now() / 1000)) {
      throw new ContractError(
        "Batch deadline has already passed",
        SdkErrorCode.SimulationFailed,
        { context: { deadline: batch.deadline } },
      );
    }

    // Optional simulation
    if (this.simulate) {
      await this.simulateBatch(batch, wallet.address, sweeperAddress);
    }

    // Submit with retry
    const txHash = await this.retry.execute(() =>
      this.submitTransaction(batch, wallet.address, sweeperAddress),
    );

    this.client.emit("sweepStarted", { batchId: batch.id, txHash });
    this.client.log(`Sweep ${batch.id} submitted: ${txHash}`);

    // Wait for confirmations
    const confirmations =
      this.confirmationsOverride ??
      this.client.getChainConfig().confirmations;

    const receipt = await this.waitForReceipt(txHash, confirmations);

    const result: SweepResult = {
      id: batch.id,
      status:
        receipt.status === "success"
          ? SweepStatus.Finalised
          : SweepStatus.Failed,
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      gasPrice: receipt.effectiveGasPrice,
      finalisedAt: new Date().toISOString(),
      error: receipt.status === "reverted" ? "Transaction reverted" : null,
    };

    if (result.status === SweepStatus.Finalised) {
      this.client.emit("sweepCompleted", result);
    } else {
      this.client.emit("sweepFailed", {
        batchId: batch.id,
        error: result.error ?? "Unknown error",
        code: SdkErrorCode.TransactionReverted,
      });
    }

    return result;
  }

  /**
   * Simulates a batch against the current chain state using `eth_call`.
   *
   * @throws {ContractError} if the simulation reverts.
   */
  async simulateBatch(
    batch: SweepBatch,
    account: `0x${string}`,
    sweeperAddress: `0x${string}`,
  ): Promise<void> {
    const publicClient = this.client.getPublicClient();
    try {
      await publicClient.call({
        to: sweeperAddress,
        data: batch.calldata,
        account,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ContractError(
        `Batch simulation failed: ${msg}`,
        SdkErrorCode.SimulationFailed,
        errOpts(err, { batchId: batch.id }),
      );
    }
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async submitTransaction(
    batch: SweepBatch,
    account: `0x${string}`,
    sweeperAddress: `0x${string}`,
  ): Promise<`0x${string}`> {
    const walletClient = this.client.getWalletClient();
    const publicClient = this.client.getPublicClient();

    const nonce = await publicClient.getTransactionCount({
      address: account,
      blockTag: "pending",
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await walletClient.sendTransaction({
        account,
        to: sweeperAddress,
        data: batch.calldata,
        gas: batch.estimatedGas,
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
    effectiveGasPrice: bigint;
  }> {
    const publicClient = this.client.getPublicClient();
    const chainCfg = this.client.getChainConfig();

    // Poll for the receipt
    const pollInterval = Math.min(chainCfg.blockTimeMs, 3_000);
    const maxWaitMs = 5 * 60 * 1_000; // 5 minutes
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      await sleep(pollInterval);

      const receipt = await publicClient
        .getTransactionReceipt({ hash: txHash })
        .catch(() => null);

      if (!receipt) continue;

      // Wait for required confirmations
      const currentBlock = await publicClient.getBlockNumber();
      const confirmedBlocks = currentBlock - receipt.blockNumber;

      if (confirmedBlocks >= BigInt(confirmations)) {
        return {
          status: receipt.status,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          effectiveGasPrice: receipt.effectiveGasPrice,
        };
      }
    }

    throw new ContractError(
      `Transaction ${txHash} not confirmed after 5 minutes`,
      SdkErrorCode.GasEstimationFailed,
      { context: { txHash, confirmations } },
    );
  }
}
