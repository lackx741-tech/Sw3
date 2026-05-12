// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title  IMulticall3
/// @notice Interface for the production Multicall3 aggregator.
///         Multicall3 is the spiritual successor to Multicall and Multicall2,
///         adding per-call success flags, ETH forwarding, and block/chain-info
///         helpers in a single canonical deployment.
interface IMulticall3 {
    // ─────────────────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice A single call to aggregate.
    /// @param target       Contract to call.
    /// @param callData     Encoded call data.
    struct Call {
        address target;
        bytes   callData;
    }

    /// @notice A call with an optional failure-revert flag.
    /// @param target       Contract to call.
    /// @param allowFailure If true, a reverted call is recorded rather than
    ///                     bubbling up.
    /// @param callData     Encoded call data.
    struct Call3 {
        address target;
        bool    allowFailure;
        bytes   callData;
    }

    /// @notice A call with ETH value and an optional failure-revert flag.
    /// @param target       Contract to call.
    /// @param allowFailure If true, a reverted call is recorded rather than
    ///                     bubbling up.
    /// @param value        ETH value in wei to forward.
    /// @param callData     Encoded call data.
    struct Call3Value {
        address target;
        bool    allowFailure;
        uint256 value;
        bytes   callData;
    }

    /// @notice Result of a single aggregated call.
    /// @param success    Whether the call succeeded.
    /// @param returnData Raw return data (empty on failure unless the target
    ///                   returned data before reverting).
    struct Result {
        bool    success;
        bytes   returnData;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when a required (non-allowFailure) call reverts.
    /// @param index  Zero-based index of the failing call.
    /// @param data   Revert data returned by the callee.
    error CallFailed(uint256 index, bytes data);

    /// @notice Thrown when msg.value does not equal the sum of all call values.
    error ValueMismatch();

    // ─────────────────────────────────────────────────────────────────────────
    //  Core aggregation
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Execute multiple calls; reverts if ANY call fails.
    /// @param calls         Array of (target, callData) pairs.
    /// @return blockNumber  Block number at execution time.
    /// @return returnData   Array of raw return data in call order.
    function aggregate(Call[] calldata calls)
        external
        payable
        returns (uint256 blockNumber, bytes[] memory returnData);

    /// @notice Execute multiple calls with per-call failure flags.
    ///         Calls where `allowFailure == true` record the failure without
    ///         reverting the whole batch.
    /// @param calls   Array of Call3 structs.
    /// @return results Array of (success, returnData) in call order.
    function aggregate3(Call3[] calldata calls)
        external
        payable
        returns (Result[] memory results);

    /// @notice Like aggregate3 but forwards ETH value to each call.
    ///         msg.value must equal the sum of all `value` fields.
    /// @param calls   Array of Call3Value structs.
    /// @return results Array of (success, returnData) in call order.
    function aggregate3Value(Call3Value[] calldata calls)
        external
        payable
        returns (Result[] memory results);

    // ─────────────────────────────────────────────────────────────────────────
    //  Block / chain info helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @return blockNumber  Current block number.
    function getBlockNumber() external view returns (uint256 blockNumber);

    /// @return blockHash    Hash of the given block.
    function getBlockHash(uint256 blockNumber) external view returns (bytes32 blockHash);

    /// @return timestamp    Current block.timestamp.
    function getCurrentBlockTimestamp() external view returns (uint256 timestamp);

    /// @return gaslimit     Current block gas limit.
    function getCurrentBlockGasLimit() external view returns (uint256 gaslimit);

    /// @return chainid      Current chain ID.
    function getChainId() external view returns (uint256 chainid);

    /// @return coinbase     Current block coinbase / fee recipient.
    function getCurrentBlockCoinbase() external view returns (address coinbase);

    /// @return balance      ETH balance of `addr`.
    function getEthBalance(address addr) external view returns (uint256 balance);

    /// @return blockHash    Hash of the last block (block.number - 1).
    function getLastBlockHash() external view returns (bytes32 blockHash);

    /// @return basefee      Current base fee per gas (EIP-1559).
    function getBasefee() external view returns (uint256 basefee);
}
