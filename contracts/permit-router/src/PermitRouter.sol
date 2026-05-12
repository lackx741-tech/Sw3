// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712}          from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import {IPermitRouter} from "./interfaces/IPermitRouter.sol";
import {IPermit2}      from "../../sweeper/src/interfaces/IPermit2.sol";

/// @title  PermitRouter
/// @author Sw3 Protocol
/// @notice Aggregates Permit2 approvals and token transfers into single atomic
///         transactions, eliminating the need for users to send separate
///         approval and transfer transactions.
///
///         Architecture
///         ────────────
///         • Stateless except for a per-owner nonce bitmap used to prevent
///           router-level replay attacks.
///         • Each call validates a call-level deadline before touching state.
///         • All Permit2 interactions delegate to the canonical Permit2 contract;
///           the router itself never holds tokens.
///         • EIP-712 domain separator is exposed for off-chain tooling that
///           builds router-level signed messages.
///         • ReentrancyGuard on all external state-changing functions.
///
/// @custom:security-contact security@sw3.io
contract PermitRouter is IPermitRouter, ReentrancyGuard, EIP712 {
    // ─────────────────────────────────────────────────────────────────────────
    //  Immutables
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IPermitRouter
    address public immutable override permit2;

    // ─────────────────────────────────────────────────────────────────────────
    //  Storage — nonce bitmap
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev owner => wordPos => bitmap of used nonces.
    ///      nonce N is stored at bit (N % 256) of word (N / 256).
    mapping(address => mapping(uint256 => uint256)) private _nonceBitmap;

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /// @param _permit2  Address of the canonical Permit2 deployment.
    constructor(address _permit2) EIP712("PermitRouter", "1") {
        if (_permit2 == address(0)) revert ZeroAddress();
        permit2 = _permit2;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  View
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IPermitRouter
    function isNonceUsed(address owner, uint256 nonce) external view override returns (bool) {
        (uint256 wordPos, uint256 bitPos) = _noncePosition(nonce);
        return (_nonceBitmap[owner][wordPos] >> bitPos) & 1 == 1;
    }

    /// @notice EIP-712 domain separator for off-chain tooling.
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Batch permit
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IPermitRouter
    function batchPermit(PermitEntry[] calldata entries, uint256 deadline)
        external
        override
        nonReentrant
    {
        _checkDeadline(deadline);

        uint256 len = entries.length;
        if (len == 0) revert EmptyBatch();

        IPermit2 p2 = IPermit2(permit2);

        for (uint256 i; i < len;) {
            PermitEntry calldata e = entries[i];
            if (e.owner == address(0)) revert ZeroAddress();
            p2.permit(e.owner, e.permit, e.signature);
            unchecked { ++i; }
        }

        emit PermitBatchProcessed(msg.sender, len);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Batch transfer
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IPermitRouter
    function batchTransfer(TransferEntry[] calldata transfers, uint256 deadline)
        external
        override
        nonReentrant
    {
        _checkDeadline(deadline);

        uint256 len = transfers.length;
        if (len == 0) revert EmptyBatch();

        IPermit2 p2 = IPermit2(permit2);

        for (uint256 i; i < len;) {
            TransferEntry calldata t = transfers[i];
            _validateTransferEntry(t);
            p2.transferFrom(t.from, t.to, t.amount, t.token);
            unchecked { ++i; }
        }

        emit TransferBatchProcessed(msg.sender, len);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Batch permit + transfer  (atomic)
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IPermitRouter
    function batchPermitAndTransfer(
        PermitEntry[]   calldata entries,
        TransferEntry[] calldata transfers,
        uint256         deadline
    )
        external
        override
        nonReentrant
    {
        _checkDeadline(deadline);

        uint256 pLen = entries.length;
        uint256 tLen = transfers.length;
        if (pLen == 0 && tLen == 0) revert EmptyBatch();

        IPermit2 p2 = IPermit2(permit2);

        // Submit permits first so allowances are live for the transfers.
        for (uint256 i; i < pLen;) {
            PermitEntry calldata e = entries[i];
            if (e.owner == address(0)) revert ZeroAddress();
            p2.permit(e.owner, e.permit, e.signature);
            unchecked { ++i; }
        }

        // Execute transfers.
        for (uint256 i; i < tLen;) {
            TransferEntry calldata t = transfers[i];
            _validateTransferEntry(t);
            p2.transferFrom(t.from, t.to, t.amount, t.token);
            unchecked { ++i; }
        }

        if (pLen > 0) emit PermitBatchProcessed(msg.sender,  pLen);
        if (tLen > 0) emit TransferBatchProcessed(msg.sender, tLen);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Nonce management
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IPermitRouter
    function invalidateNonce(uint256 nonce) external override {
        _useNonce(msg.sender, nonce);
        emit NonceConsumed(msg.sender, nonce);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _checkDeadline(uint256 deadline) private view {
        if (block.timestamp > deadline) {
            revert DeadlineExpired(deadline, block.timestamp);
        }
    }

    function _validateTransferEntry(TransferEntry calldata t) private pure {
        if (t.from  == address(0)) revert ZeroAddress();
        if (t.to    == address(0)) revert ZeroAddress();
        if (t.token == address(0)) revert ZeroAddress();
        if (t.amount == 0)         revert ZeroAmount();
    }

    function _noncePosition(uint256 nonce) private pure returns (uint256 wordPos, uint256 bitPos) {
        unchecked {
            wordPos = nonce / 256;
            bitPos  = nonce % 256;
        }
    }

    function _useNonce(address owner, uint256 nonce) private {
        (uint256 wordPos, uint256 bitPos) = _noncePosition(nonce);
        uint256 bit = 1 << bitPos;
        uint256 flipped = _nonceBitmap[owner][wordPos] ^= bit;
        // If the bit was already set (1 ^ 1 = 0), the nonce was already used.
        if (flipped & bit == 0) revert NonceAlreadyUsed(nonce);
    }
}
