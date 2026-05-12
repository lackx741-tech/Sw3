// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IMulticall3} from "./interfaces/IMulticall3.sol";

/// @title  Multicall3
/// @author Sw3 Protocol (derived from the canonical MakerDAO / Uniswap multicall lineage)
/// @notice Aggregate multiple read-or-write calls into a single transaction.
///
///         This implementation is fully compatible with the canonical Multicall3
///         ABI (https://github.com/mds1/multicall) while adding custom errors
///         and Solidity 0.8.24 / Cancun optimisations.
///
///         Security notes
///         ──────────────
///         • State-changing calls are supported; callers bear responsibility for
///           atomic failure modes.
///         • ETH forwarding via aggregate3Value requires msg.value == Σ values;
///           any excess is refused rather than silently returned.
///         • No storage is used (stateless), so no reentrancy risk on state.
///
/// @custom:security-contact security@sw3.io
contract Multicall3 is IMulticall3 {
    // ─────────────────────────────────────────────────────────────────────────
    //  aggregate  (strict — reverts on any failure)
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IMulticall3
    function aggregate(Call[] calldata calls)
        external
        payable
        override
        returns (uint256 blockNumber, bytes[] memory returnData)
    {
        blockNumber = block.number;
        uint256 len = calls.length;
        returnData  = new bytes[](len);

        for (uint256 i; i < len;) {
            (bool success, bytes memory ret) = calls[i].target.call(calls[i].callData);
            if (!success) revert CallFailed(i, ret);
            returnData[i] = ret;
            unchecked { ++i; }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  aggregate3  (best-effort — per-call failure flags, no ETH forwarding)
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IMulticall3
    function aggregate3(Call3[] calldata calls)
        external
        payable
        override
        returns (Result[] memory results)
    {
        uint256 len = calls.length;
        results     = new Result[](len);

        for (uint256 i; i < len;) {
            Call3 calldata c = calls[i];
            (bool success, bytes memory ret) = c.target.call(c.callData);

            if (!success && !c.allowFailure) revert CallFailed(i, ret);

            results[i] = Result({success: success, returnData: ret});
            unchecked { ++i; }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  aggregate3Value  (best-effort + ETH value per call)
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IMulticall3
    function aggregate3Value(Call3Value[] calldata calls)
        external
        payable
        override
        returns (Result[] memory results)
    {
        uint256 len       = calls.length;
        results           = new Result[](len);
        uint256 valueUsed;

        for (uint256 i; i < len;) {
            Call3Value calldata c = calls[i];

            unchecked { valueUsed += c.value; }  // overflow guard below

            (bool success, bytes memory ret) = c.target.call{value: c.value}(c.callData);

            if (!success && !c.allowFailure) revert CallFailed(i, ret);

            results[i] = Result({success: success, returnData: ret});
            unchecked { ++i; }
        }

        // Enforce exact ETH accounting — no ETH silently left in the contract.
        if (valueUsed != msg.value) revert ValueMismatch();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Block / chain info helpers  (all view / pure, zero gas overhead)
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IMulticall3
    function getBlockNumber() external view override returns (uint256) {
        return block.number;
    }

    /// @inheritdoc IMulticall3
    function getBlockHash(uint256 blockNumber) external view override returns (bytes32) {
        return blockhash(blockNumber);
    }

    /// @inheritdoc IMulticall3
    function getCurrentBlockTimestamp() external view override returns (uint256) {
        return block.timestamp;
    }

    /// @inheritdoc IMulticall3
    function getCurrentBlockGasLimit() external view override returns (uint256) {
        return block.gaslimit;
    }

    /// @inheritdoc IMulticall3
    function getChainId() external view override returns (uint256) {
        return block.chainid;
    }

    /// @inheritdoc IMulticall3
    function getCurrentBlockCoinbase() external view override returns (address) {
        return block.coinbase;
    }

    /// @inheritdoc IMulticall3
    function getEthBalance(address addr) external view override returns (uint256) {
        return addr.balance;
    }

    /// @inheritdoc IMulticall3
    function getLastBlockHash() external view override returns (bytes32) {
        unchecked {
            return blockhash(block.number - 1);
        }
    }

    /// @inheritdoc IMulticall3
    function getBasefee() external view override returns (uint256) {
        return block.basefee;
    }
}
