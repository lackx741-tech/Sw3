// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA}           from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712}          from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import {IDelegatedExecutor} from "./interfaces/IDelegatedExecutor.sol";

/// @title  DelegatedExecutor
/// @author Sw3 Protocol
/// @notice EIP-7702-style delegated execution router.
///
///         Architecture
///         ────────────
///         • EOAs sign an EIP-712 `Authorization` struct listing the calls they
///           want executed and the nonce + deadline that guard against replay.
///         • Relayers (RELAYER_ROLE) call `executeDelegated`, which recovers the
///           signer, consumes the nonce, and executes the calls.
///         • Nonces are stored in a packed bitmap (one 256-bit word covers 256
///           nonces) for gas-efficient replay protection.
///         • The contract is pausable; only PAUSER_ROLE can pause / unpause.
///         • ETH forwarded with the call is distributed to individual call values;
///           the contract never accumulates ETH balance.
///
/// @custom:security-contact security@sw3.io
contract DelegatedExecutor is IDelegatedExecutor, AccessControl, Pausable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    // ─────────────────────────────────────────────────────────────────────────
    //  EIP-712 type hashes
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev keccak256("Call(address target,uint256 value,bytes data)")
    bytes32 private constant _CALL_TYPEHASH =
        keccak256("Call(address target,uint256 value,bytes data)");

    /// @dev keccak256("Authorization(address signer,uint256 nonce,uint256 deadline,Call[] calls)Call(address target,uint256 value,bytes data)")
    bytes32 private constant _AUTHORIZATION_TYPEHASH =
        keccak256(
            "Authorization(address signer,uint256 nonce,uint256 deadline,Call[] calls)"
            "Call(address target,uint256 value,bytes data)"
        );

    // ─────────────────────────────────────────────────────────────────────────
    //  Role constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Role required to submit delegated executions.
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    /// @notice Role allowed to pause / unpause the contract.
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    //  Storage — nonce bitmap
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev signer => wordPos => bitmap.
    ///      Nonce N is stored at bit (N % 256) of word (N / 256).
    mapping(address => mapping(uint256 => uint256)) private _nonceBitmap;

    /// @dev Reserved storage for future upgrades.
    uint256[47] private __gap;

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /// @param admin Initial holder of DEFAULT_ADMIN_ROLE (also gets RELAYER_ROLE
    ///              and PAUSER_ROLE for convenience).
    constructor(address admin) EIP712("DelegatedExecutor", "1") {
        if (admin == address(0)) revert ZeroSigner(); // reuse most-appropriate error

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE,       admin);
        _grantRole(PAUSER_ROLE,        admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Receive ETH
    // ─────────────────────────────────────────────────────────────────────────

    receive() external payable {}

    // ─────────────────────────────────────────────────────────────────────────
    //  Pause controls
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Pause all delegated executions.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpause delegated executions.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  View / pure
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IDelegatedExecutor
    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @inheritdoc IDelegatedExecutor
    function isNonceUsed(address signer, uint256 nonce) external view override returns (bool) {
        (uint256 wordPos, uint256 bitPos) = _noncePosition(nonce);
        return (_nonceBitmap[signer][wordPos] >> bitPos) & 1 == 1;
    }

    /// @inheritdoc IDelegatedExecutor
    function hashAuthorization(Authorization calldata auth)
        external
        view
        override
        returns (bytes32)
    {
        return _hashTypedDataV4(_authorizationDigest(auth));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core — delegated execution
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IDelegatedExecutor
    /// @dev msg.value must equal the sum of all call values in `auth.calls`.
    function executeDelegated(
        Authorization calldata auth,
        bytes calldata signature
    )
        external
        payable
        override
        onlyRole(RELAYER_ROLE)
        whenNotPaused
        nonReentrant
    {
        // 1. Deadline
        if (block.timestamp > auth.deadline) {
            revert DeadlineExpired(auth.deadline, block.timestamp);
        }

        // 2. Non-zero signer
        if (auth.signer == address(0)) revert ZeroSigner();

        // 3. Non-empty call list
        uint256 callCount = auth.calls.length;
        if (callCount == 0) revert EmptyCalls();

        // 4. Validate call targets
        for (uint256 i; i < callCount;) {
            if (auth.calls[i].target == address(0)) revert ZeroTarget(i);
            unchecked { ++i; }
        }

        // 5. ETH value accounting
        uint256 totalValue;
        for (uint256 i; i < callCount;) {
            unchecked { totalValue += auth.calls[i].value; }
            unchecked { ++i; }
        }
        if (msg.value < totalValue) {
            revert InsufficientValue(totalValue, msg.value);
        }

        // 6. Recover signer
        bytes32 digest   = _hashTypedDataV4(_authorizationDigest(auth));
        address recovered = digest.recover(signature);
        if (recovered != auth.signer) {
            revert InvalidSigner(auth.signer, recovered);
        }

        // 7. Consume nonce
        _useNonce(auth.signer, auth.nonce);

        // 8. Execute calls
        for (uint256 i; i < callCount;) {
            Call calldata c = auth.calls[i];
            (bool ok, bytes memory ret) = c.target.call{value: c.value}(c.data);
            if (!ok) revert CallReverted(i, ret);
            unchecked { ++i; }
        }

        emit DelegatedExecuted(auth.signer, auth.nonce, callCount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Nonce invalidation
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IDelegatedExecutor
    function invalidateNonce(uint256 nonce) external override {
        _useNonce(msg.sender, nonce);
        emit NonceInvalidated(msg.sender, nonce);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Hash an individual `Call` struct according to EIP-712.
    function _hashCall(Call calldata c) private pure returns (bytes32) {
        return keccak256(abi.encode(_CALL_TYPEHASH, c.target, c.value, keccak256(c.data)));
    }

    /// @dev Build the struct hash for `Authorization` (without the domain prefix).
    function _authorizationDigest(Authorization calldata auth)
        private
        pure
        returns (bytes32)
    {
        uint256 len = auth.calls.length;
        bytes32[] memory callHashes = new bytes32[](len);
        for (uint256 i; i < len;) {
            callHashes[i] = _hashCall(auth.calls[i]);
            unchecked { ++i; }
        }
        return keccak256(
            abi.encode(
                _AUTHORIZATION_TYPEHASH,
                auth.signer,
                auth.nonce,
                auth.deadline,
                keccak256(abi.encodePacked(callHashes))
            )
        );
    }

    /// @dev Compute the (wordPos, bitPos) pair for a nonce.
    function _noncePosition(uint256 nonce)
        private
        pure
        returns (uint256 wordPos, uint256 bitPos)
    {
        unchecked {
            wordPos = nonce / 256;
            bitPos  = nonce % 256;
        }
    }

    /// @dev Mark `nonce` as used for `signer`.  Reverts if already consumed.
    function _useNonce(address signer, uint256 nonce) private {
        (uint256 wordPos, uint256 bitPos) = _noncePosition(nonce);
        uint256 bit    = 1 << bitPos;
        uint256 before = _nonceBitmap[signer][wordPos];
        if (before & bit != 0) revert NonceAlreadyUsed(signer, nonce);
        _nonceBitmap[signer][wordPos] = before | bit;
    }
}
