// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title  FeeLib
/// @notice Pure helper library for basis-point fee arithmetic.
///         All calculations are done in 256-bit math; intermediate products
///         cannot overflow because `amount` is bounded by the ERC20 supply
///         (≤ 2^256-1) and `bps` is capped at 1 000 (≤ 10 ^18 · 10^3 fits).
library FeeLib {
    // ─────────────────────────────────────────────────────────────────────────
    //  Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev  10 000 basis points = 100 %.
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    /// @dev  Protocol hard-cap: 1 000 bps = 10 %.
    uint256 internal constant MAX_FEE_BPS = 1_000;

    // ─────────────────────────────────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when `bps` exceeds `MAX_FEE_BPS`.
    /// @param provided The supplied bps value.
    /// @param max      The maximum allowed value.
    error FeeLib__FeeTooHigh(uint256 provided, uint256 max);

    // ─────────────────────────────────────────────────────────────────────────
    //  Validation
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Revert if `bps` is above the protocol maximum.
    /// @param bps Basis-point fee to validate.
    function validateBps(uint256 bps) internal pure {
        if (bps > MAX_FEE_BPS) revert FeeLib__FeeTooHigh(bps, MAX_FEE_BPS);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Calculation helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Compute the fee amount for a given gross `amount` and `bps`.
    /// @param amount Gross token amount (in token's smallest unit).
    /// @param bps    Fee in basis points.
    /// @return fee   Calculated fee; rounds *down* in favour of the user.
    function calcFee(uint256 amount, uint256 bps) internal pure returns (uint256 fee) {
        // When bps == 0 avoid the multiplication entirely.
        if (bps == 0) return 0;
        // (amount * bps) / 10_000  — cannot overflow: amount < 2^256, bps ≤ 1_000
        unchecked {
            fee = (amount * bps) / BPS_DENOMINATOR;
        }
    }

    /// @notice Split `amount` into (fee, net) pair.
    /// @param amount Gross token amount.
    /// @param bps    Fee in basis points.
    /// @return fee   Portion routed to the fee recipient.
    /// @return net   Portion delivered to the final recipient.
    function split(uint256 amount, uint256 bps) internal pure returns (uint256 fee, uint256 net) {
        fee = calcFee(amount, bps);
        unchecked {
            net = amount - fee; // safe: fee ≤ amount because bps ≤ BPS_DENOMINATOR
        }
    }
}
