// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPermit2} from "../../sweeper/src/interfaces/IPermit2.sol";

/// @title  IPermitRouter
/// @notice Interface for the PermitRouter contract, which aggregates multiple
///         Permit2 approvals and/or token transfers into a single atomic
///         transaction.
///
///         The router is intentionally stateless (except nonce tracking) to
///         minimise the trust surface.  Every approval or transfer is routed
///         directly through the canonical Permit2 contract.
interface IPermitRouter {
    // ─────────────────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice A single batch-permit entry: one signed permit plus a spender
    ///         and deadline that match what is inside the PermitSingle.
    /// @param owner     Address whose signature is attached.
    /// @param permit    The Permit2 PermitSingle struct.
    /// @param signature Packed ECDSA or EIP-1271 signature over the permit.
    struct PermitEntry {
        address                  owner;
        IPermit2.PermitSingle    permit;
        bytes                    signature;
    }

    /// @notice A single batch-transfer entry to be executed via Permit2.
    ///         The `owner` must have an active Permit2 allowance for the
    ///         router by the time this is processed.
    /// @param from    Source address.
    /// @param to      Destination address.
    /// @param token   ERC20 token.
    /// @param amount  Amount to transfer (uint160 to match Permit2's type).
    struct TransferEntry {
        address from;
        address to;
        address token;
        uint160 amount;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted after a batch of permits is processed.
    /// @param caller      msg.sender that submitted the batch.
    /// @param permitCount Number of permits processed.
    event PermitBatchProcessed(address indexed caller, uint256 permitCount);

    /// @notice Emitted after a batch of transfers is processed.
    /// @param caller         msg.sender that submitted the batch.
    /// @param transferCount  Number of transfers executed.
    event TransferBatchProcessed(address indexed caller, uint256 transferCount);

    /// @notice Emitted when a router-level nonce is consumed.
    /// @param owner Address whose nonce was consumed.
    /// @param nonce The nonce value that was used.
    event NonceConsumed(address indexed owner, uint256 nonce);

    // ─────────────────────────────────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Batch arrays were empty.
    error EmptyBatch();

    /// @notice Call deadline has expired.
    /// @param deadline  The expired timestamp.
    /// @param blockTime Current block.timestamp.
    error DeadlineExpired(uint256 deadline, uint256 blockTime);

    /// @notice A zero address was passed where a non-zero is required.
    error ZeroAddress();

    /// @notice A zero amount was included in a transfer entry.
    error ZeroAmount();

    /// @notice The supplied router-level nonce has already been used.
    /// @param nonce The duplicate nonce.
    error NonceAlreadyUsed(uint256 nonce);

    // ─────────────────────────────────────────────────────────────────────────
    //  View
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns the Permit2 contract address.
    function permit2() external view returns (address);

    /// @notice Returns true if the given router-level nonce has been consumed
    ///         by `owner`.
    /// @param owner  The address whose nonce bitmap to query.
    /// @param nonce  The nonce to check.
    function isNonceUsed(address owner, uint256 nonce) external view returns (bool);

    // ─────────────────────────────────────────────────────────────────────────
    //  State-changing
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Process a batch of Permit2 signed approvals in a single call.
    ///         Each entry's permit is submitted individually to Permit2.
    /// @param entries   Array of permit entries to process.
    /// @param deadline  Unix timestamp after which the call reverts.
    function batchPermit(PermitEntry[] calldata entries, uint256 deadline) external;

    /// @notice Execute a batch of Permit2 token transfers.
    ///         Callers must have pre-approved Permit2 and have an active
    ///         allowance for this router.
    /// @param transfers  Array of transfer entries.
    /// @param deadline   Unix timestamp after which the call reverts.
    function batchTransfer(TransferEntry[] calldata transfers, uint256 deadline) external;

    /// @notice Atomically submit permits AND execute transfers in one call.
    ///         The permits are submitted first so the resulting allowances are
    ///         immediately available for the transfers.
    /// @param entries    Permit entries to submit.
    /// @param transfers  Transfers to execute after permits are registered.
    /// @param deadline   Unix timestamp for the combined call.
    function batchPermitAndTransfer(
        PermitEntry[]   calldata entries,
        TransferEntry[] calldata transfers,
        uint256         deadline
    ) external;

    /// @notice Invalidate a router-level nonce to prevent replays of any
    ///         off-chain message that references it.
    /// @param nonce  The nonce to mark as used.
    function invalidateNonce(uint256 nonce) external;
}
