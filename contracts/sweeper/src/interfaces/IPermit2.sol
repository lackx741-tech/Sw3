// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title  IPermit2
/// @notice Minimal interface for Uniswap's Permit2 contract covering only the
///         AllowanceTransfer flows required by the Sweeper contract.
/// @dev    Full Permit2 spec: https://github.com/Uniswap/permit2
interface IPermit2 {
    // ─────────────────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Packed token permissions that form the core of a permit.
    /// @param token   ERC20 token address.
    /// @param amount  Maximum amount that may be transferred under this permit.
    /// @param expiration  Unix timestamp after which the permit is invalid.
    /// @param nonce   Per-token, per-spender nonce to prevent replay.
    struct PermitDetails {
        address token;
        uint160 amount;
        uint48  expiration;
        uint48  nonce;
    }

    /// @notice A single-token permit, signed by the token owner.
    /// @param details   Core permit parameters.
    /// @param spender   The address allowed to call transferFrom.
    /// @param sigDeadline  Deadline for the signature itself (may differ from
    ///                  expiration so the signed message can be submitted late
    ///                  even after approval expiry is set far in the future).
    struct PermitSingle {
        PermitDetails details;
        address spender;
        uint256 sigDeadline;
    }

    /// @notice A multi-token permit, signed by the token owner.
    /// @param details     Array of per-token permit details.
    /// @param spender     The address allowed to call transferFrom for all tokens.
    /// @param sigDeadline Deadline for the signature.
    struct PermitBatch {
        PermitDetails[] details;
        address         spender;
        uint256         sigDeadline;
    }

    /// @notice Describes a single token transfer to be executed by Permit2.
    /// @param from    Source address (must have approved Permit2 and signed a permit).
    /// @param to      Destination address.
    /// @param amount  Amount to transfer.
    /// @param token   ERC20 token address.
    struct AllowanceTransferDetails {
        address from;
        address to;
        uint160 amount;
        address token;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a new allowance is approved through permit.
    event Approval(
        address indexed owner,
        address indexed token,
        address indexed spender,
        uint160 amount,
        uint48  expiration
    );

    /// @notice Emitted when a permit is used to set an allowance.
    event Permit(
        address indexed owner,
        address indexed token,
        address indexed spender,
        uint160 amount,
        uint48  expiration,
        uint48  nonce
    );

    /// @notice Emitted when an allowance is used up (invalidated by owner).
    event Lockdown(address indexed owner, address token, address spender);

    // ─────────────────────────────────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when the permit signature deadline has passed.
    error SignatureExpired(uint256 signatureDeadline);

    /// @notice Thrown when an invalid nonce is supplied.
    error InvalidNonce();

    // ─────────────────────────────────────────────────────────────────────────
    //  AllowanceTransfer — view
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns the stored allowance for (owner, token, spender).
    /// @return amount      Approved transfer amount.
    /// @return expiration  Unix timestamp when the allowance expires.
    /// @return nonce       Current nonce (monotonically increases on each permit).
    function allowance(address owner, address token, address spender)
        external
        view
        returns (uint160 amount, uint48 expiration, uint48 nonce);

    // ─────────────────────────────────────────────────────────────────────────
    //  AllowanceTransfer — state-changing
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Approve a spender to transfer up to `amount` of `token` on
    ///         behalf of `msg.sender` until `expiration`.
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;

    /// @notice Process a single-token permit signed by the token owner.
    function permit(address owner, PermitSingle calldata permitSingle, bytes calldata signature) external;

    /// @notice Process a multi-token permit signed by the token owner.
    function permit(address owner, PermitBatch calldata permitBatch, bytes calldata signature) external;

    /// @notice Execute a single allowance-based transfer.
    function transferFrom(address from, address to, uint160 amount, address token) external;

    /// @notice Execute a batch of allowance-based transfers from multiple owners.
    function transferFrom(AllowanceTransferDetails[] calldata transferDetails) external;

    /// @notice Invalidate any number of nonces for the caller, resetting
    ///         existing permits that used those nonces.
    function invalidateNonces(address token, address spender, uint48 newNonce) external;
}
