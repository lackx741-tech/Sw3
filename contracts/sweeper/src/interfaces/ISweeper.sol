// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPermit2} from "./IPermit2.sol";

/// @title  ISweeper
/// @notice Public interface for the ERC20 batch-sweep contract.
///         Sweeper aggregates multiple token transfers in a single call with
///         optional Permit2 signature-based approvals and automatic fee
///         extraction in basis points.
interface ISweeper {
    // ─────────────────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Parameters for a single token sweep leg.
    /// @param token      ERC20 token to sweep.
    /// @param from       Source address whose tokens are swept.
    /// @param to         Final recipient of the net (post-fee) amount.
    /// @param amount     Gross amount to pull from `from`.
    struct SweepLeg {
        address token;
        address from;
        address to;
        uint256 amount;
    }

    /// @notice Permit2-flavoured sweep leg: carries the signed permit alongside
    ///         the transfer details so the contract can atomically approve +
    ///         transfer in one call.
    /// @param leg       Core sweep parameters (token, from, to, amount).
    /// @param permit    Permit2 PermitSingle struct signed by `leg.from`.
    /// @param signature Packed ECDSA / EIP-1271 signature.
    struct PermitSweepLeg {
        SweepLeg leg;
        IPermit2.PermitSingle permit;
        bytes signature;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted for every successfully swept leg.
    /// @param token       ERC20 token swept.
    /// @param from        Source address.
    /// @param to          Recipient of the net amount.
    /// @param grossAmount Total tokens pulled from `from`.
    /// @param fee         Tokens retained by the fee recipient.
    /// @param netAmount   Tokens delivered to `to`.
    event Swept(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 grossAmount,
        uint256 fee,
        uint256 netAmount
    );

    /// @notice Emitted when the fee in basis points changes.
    /// @param oldBps Previous fee.
    /// @param newBps New fee.
    event FeeBpsUpdated(uint256 oldBps, uint256 newBps);

    /// @notice Emitted when the fee recipient address changes.
    /// @param oldRecipient Previous recipient.
    /// @param newRecipient New recipient.
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    /// @notice Emitted when ERC20 tokens are rescued from the contract.
    /// @param token     Token rescued.
    /// @param to        Recipient of the rescued tokens.
    /// @param amount    Amount rescued.
    event ERC20Rescued(address indexed token, address indexed to, uint256 amount);

    /// @notice Emitted when ETH is rescued from the contract.
    /// @param to     Recipient.
    /// @param amount Amount of ETH in wei.
    event ETHRescued(address indexed to, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Array lengths do not match or are zero.
    error ArrayLengthMismatch();

    /// @notice An empty legs array was supplied to a batch function.
    error EmptyLegs();

    /// @notice The submitted fee in bps exceeds the protocol maximum.
    /// @param provided The bps value that was submitted.
    /// @param max      The maximum allowed bps.
    error FeeTooHigh(uint256 provided, uint256 max);

    /// @notice A zero-value address was supplied where a non-zero is required.
    error ZeroAddress();

    /// @notice A zero amount was supplied in a sweep leg.
    error ZeroAmount();

    /// @notice The call-level or permit deadline has elapsed.
    /// @param deadline  The expired timestamp.
    /// @param blockTime The current block.timestamp.
    error DeadlineExpired(uint256 deadline, uint256 blockTime);

    /// @notice Rescue attempted on the zero address token.
    error InvalidRescueToken();

    // ─────────────────────────────────────────────────────────────────────────
    //  View / pure
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns the Permit2 contract address used by this Sweeper.
    function permit2() external view returns (address);

    /// @notice Current fee in basis points (1 bps = 0.01 %).
    function feeBps() external view returns (uint256);

    /// @notice Address that accumulates collected fees.
    function feeRecipient() external view returns (address);

    /// @notice EIP-712 domain separator for this contract.
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    // ─────────────────────────────────────────────────────────────────────────
    //  State-changing — admin
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Update the fee in basis points. Max is 1 000 bps (10 %).
    /// @param newBps New fee, must be ≤ 1 000.
    function setFeeBps(uint256 newBps) external;

    /// @notice Update the address that receives protocol fees.
    /// @param newRecipient New fee recipient; must be non-zero.
    function setFeeRecipient(address newRecipient) external;

    // ─────────────────────────────────────────────────────────────────────────
    //  State-changing — sweeps
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Batch-sweep using ERC20 allowances already granted to this contract.
    /// @dev    The caller must hold OPERATOR_ROLE.
    ///         Each `from` address must have approved this contract for the
    ///         corresponding `amount` of `token`.
    /// @param legs     Array of sweep legs to process.
    /// @param deadline Unix timestamp after which the call reverts.
    function batchSweep(SweepLeg[] calldata legs, uint256 deadline) external;

    /// @notice Batch-sweep using Permit2 signatures — no prior ERC20 approval
    ///         to this contract required; Permit2 itself must be approved by
    ///         each `from` address.
    /// @dev    The caller must hold OPERATOR_ROLE.
    /// @param legs     Array of Permit2 sweep legs, each carrying its own
    ///                 signed permit and signature.
    /// @param deadline Unix timestamp after which the call reverts.
    function batchSweepWithPermit2(PermitSweepLeg[] calldata legs, uint256 deadline) external;

    // ─────────────────────────────────────────────────────────────────────────
    //  State-changing — emergency
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Transfer stuck ERC20 tokens to a recovery address.
    /// @dev    Requires DEFAULT_ADMIN_ROLE. Cannot rescue the zero address.
    /// @param token  Token to recover.
    /// @param to     Destination address.
    /// @param amount Amount to transfer.
    function rescueERC20(address token, address to, uint256 amount) external;

    /// @notice Transfer stuck ETH to a recovery address.
    /// @dev    Requires DEFAULT_ADMIN_ROLE.
    /// @param to     Destination address (must accept ETH).
    /// @param amount Amount in wei.
    function rescueETH(address payable to, uint256 amount) external;
}
