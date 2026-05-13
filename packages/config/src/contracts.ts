/**
 * Contract address registry for the Sw3 platform.
 *
 * Each chain has a set of deployed contract addresses used by the SDK and UI.
 * `null` means the contract has not been deployed to that chain yet.
 */

import { ChainId } from "@sw3/shared-types";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-chain contract address bundle. */
export interface ContractAddresses {
  /**
   * Main ERC-20 sweeper contract.
   * Accepts batched sweep instructions and executes token transfers.
   */
  sweeper: `0x${string}` | null;
  /**
   * Multicall3 contract used for batching read calls.
   * @see https://github.com/mds1/multicall
   */
  multicall: `0x${string}`;
  /**
   * Fee router contract that distributes platform fees to recipients.
   */
  feeRouter: `0x${string}` | null;
  /**
   * Permit-based sweep router contract that accepts Permit2 signatures.
   */
  permitRouter: `0x${string}` | null;
  /**
   * Uniswap Permit2 contract address.
   * This is the same across all EVM chains.
   */
  permit2: `0x${string}`;
  /**
   * EIP-7702-style delegated execution router.
   * Accepts signed Authorization payloads and executes batched calls.
   */
  delegatedExecutor: `0x${string}` | null;
}

// ─── Multicall3 is deployed at the same address on all EVM chains ─────────────
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

/** Uniswap Permit2 — deployed at the same address on every EVM chain. */
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

// ─── Address registry ─────────────────────────────────────────────────────────

/**
 * Contract address registry, keyed by {@link ChainId}.
 *
 * Addresses marked `null` indicate the contract is not yet deployed on that
 * chain.  SDK calls for undeployed contracts will throw a `ContractError`.
 */
export const CONTRACT_ADDRESSES: Readonly<
  Record<ChainId, ContractAddresses>
> = {
  [ChainId.Mainnet]: {
    sweeper: "0x1111111111111111111111111111111111111111",
    multicall: MULTICALL3,
    feeRouter: "0x2222222222222222222222222222222222222222",
    permitRouter: "0x3333333333333333333333333333333333333333",
    permit2: PERMIT2,
    delegatedExecutor: null,
  },
  [ChainId.Goerli]: {
    sweeper: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    multicall: MULTICALL3,
    feeRouter: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    permitRouter: "0xcccccccccccccccccccccccccccccccccccccccc",
    permit2: PERMIT2,
    delegatedExecutor: null,
  },
  [ChainId.Sepolia]: {
    sweeper: "0xdddddddddddddddddddddddddddddddddddddddd",
    multicall: MULTICALL3,
    feeRouter: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    permitRouter: "0xffffffffffffffffffffffffffffffffffffffff",
    permit2: PERMIT2,
    delegatedExecutor: null,
  },
  [ChainId.Arbitrum]: {
    sweeper: "0x4444444444444444444444444444444444444444",
    multicall: MULTICALL3,
    feeRouter: "0x5555555555555555555555555555555555555555",
    permitRouter: "0x6666666666666666666666666666666666666666",
    permit2: PERMIT2,
    delegatedExecutor: null,
  },
  [ChainId.Optimism]: {
    sweeper: "0x7777777777777777777777777777777777777777",
    multicall: MULTICALL3,
    feeRouter: "0x8888888888888888888888888888888888888888",
    permitRouter: "0x9999999999999999999999999999999999999999",
    permit2: PERMIT2,
    delegatedExecutor: null,
  },
  [ChainId.Polygon]: {
    sweeper: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    multicall: MULTICALL3,
    feeRouter: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    permitRouter: "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    permit2: PERMIT2,
    delegatedExecutor: null,
  },
  [ChainId.Base]: {
    sweeper: "0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    multicall: MULTICALL3,
    feeRouter: "0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
    permitRouter: "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    permit2: PERMIT2,
    delegatedExecutor: null,
  },
} as const;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * Returns the full {@link ContractAddresses} bundle for the given chain.
 *
 * @throws {Error} if the chain is unsupported.
 */
export function getContractAddresses(chainId: ChainId): ContractAddresses {
  const addrs = CONTRACT_ADDRESSES[chainId];
  if (!addrs) {
    throw new Error(`No contract addresses registered for chain ${chainId}`);
  }
  return addrs;
}

/**
 * Returns a specific contract address for a chain, asserting it is deployed.
 *
 * @throws {Error} if the chain is unsupported or the contract is not deployed.
 *
 * @example
 * ```ts
 * const sweeperAddr = getContractAddress(ChainId.Mainnet, "sweeper");
 * ```
 */
export function getContractAddress<K extends keyof ContractAddresses>(
  chainId: ChainId,
  contract: K,
): NonNullable<ContractAddresses[K]> {
  const addrs = getContractAddresses(chainId);
  const addr = addrs[contract];
  if (!addr) {
    throw new Error(
      `Contract "${contract}" is not deployed on chain ${chainId}`,
    );
  }
  return addr as NonNullable<ContractAddresses[K]>;
}
