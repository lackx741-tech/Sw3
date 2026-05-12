// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ISweeper} from "../interfaces/ISweeper.sol";

/// @title  SweepLib
/// @notice Pure helper library that validates sweep inputs and packs / unpacks
///         calldata structures so the main Sweeper contract stays lean.
library SweepLib {
    // ─────────────────────────────────────────────────────────────────────────
    //  Errors (prefixed to avoid shadowing ISweeper errors)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when `legs` is empty.
    error SweepLib__EmptyLegs();

    /// @notice Thrown when any leg contains a zero-value address.
    /// @param legIndex Position of the invalid leg in the array.
    error SweepLib__ZeroAddress(uint256 legIndex);

    /// @notice Thrown when any leg carries a zero amount.
    /// @param legIndex Position of the invalid leg in the array.
    error SweepLib__ZeroAmount(uint256 legIndex);

    /// @notice Thrown when the call deadline has passed.
    /// @param deadline  Submitted timestamp.
    /// @param blockTime Current block.timestamp.
    error SweepLib__DeadlineExpired(uint256 deadline, uint256 blockTime);

    // ─────────────────────────────────────────────────────────────────────────
    //  Validation
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Validate a batch deadline — reverts if expired.
    /// @param deadline Unix timestamp supplied by the caller.
    function checkDeadline(uint256 deadline) internal view {
        if (block.timestamp > deadline) {
            revert SweepLib__DeadlineExpired(deadline, block.timestamp);
        }
    }

    /// @notice Validate all legs in an allowance-based batch sweep.
    ///         Reverts on the first offending leg with the leg index attached.
    /// @param legs Array of SweepLeg structs to validate.
    function validateLegs(ISweeper.SweepLeg[] calldata legs) internal pure {
        uint256 len = legs.length;
        if (len == 0) revert SweepLib__EmptyLegs();

        for (uint256 i; i < len;) {
            _validateSingleLeg(legs[i].token, legs[i].from, legs[i].to, legs[i].amount, i);
            unchecked { ++i; }
        }
    }

    /// @notice Validate all legs in a Permit2-based batch sweep.
    /// @param legs Array of PermitSweepLeg structs to validate.
    function validatePermitLegs(ISweeper.PermitSweepLeg[] calldata legs) internal pure {
        uint256 len = legs.length;
        if (len == 0) revert SweepLib__EmptyLegs();

        for (uint256 i; i < len;) {
            ISweeper.SweepLeg calldata l = legs[i].leg;
            _validateSingleLeg(l.token, l.from, l.to, l.amount, i);
            unchecked { ++i; }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Packing helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Pack `(amount, to)` into a single bytes32 slot for event logging
    ///         when the fields fit in the available bit widths.
    ///         amount is truncated to 160 bits (≤ max uint160); to fits in 160
    ///         bits by definition. NOT used in critical paths — events only.
    /// @param amount Token amount (must fit uint160).
    /// @param to     Destination address.
    /// @return packed 32-byte word: upper 96 bits = truncated amount,
    ///                lower 160 bits = address.
    function packAmountTo(uint256 amount, address to) internal pure returns (bytes32 packed) {
        // Shift truncated amount into the upper 96 bits, OR in the address.
        packed = bytes32((amount << 160) | uint256(uint160(to)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _validateSingleLeg(
        address token,
        address from,
        address to,
        uint256 amount,
        uint256 index
    ) private pure {
        if (token == address(0) || from == address(0) || to == address(0)) {
            revert SweepLib__ZeroAddress(index);
        }
        if (amount == 0) revert SweepLib__ZeroAmount(index);
    }
}
