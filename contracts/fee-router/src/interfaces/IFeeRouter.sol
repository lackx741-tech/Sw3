// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title  IFeeRouter
/// @notice Interface for the FeeRouter contract that distributes ERC20 and
///         native ETH payments across multiple fee recipients according to
///         configurable basis-point splits.
interface IFeeRouter {
    // ─────────────────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice A single recipient with an associated share of incoming fees.
    /// @param recipient  Address that receives this share.
    /// @param bps        Share in basis points (1 bps = 0.01 %).
    ///                   The sum across all recipients must equal 10 000.
    struct RecipientConfig {
        address recipient;
        uint256 bps;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a new recipient configuration is installed.
    /// @param configHash  keccak256 of the encoded RecipientConfig array.
    /// @param recipients  The new configuration.
    event RecipientsUpdated(bytes32 indexed configHash, RecipientConfig[] recipients);

    /// @notice Emitted after each ERC20 distribution.
    /// @param token       Token distributed.
    /// @param totalAmount Total tokens distributed across all recipients.
    event ERC20Distributed(address indexed token, uint256 totalAmount);

    /// @notice Emitted after each ETH distribution.
    /// @param totalAmount Total wei distributed across all recipients.
    event ETHDistributed(uint256 totalAmount);

    /// @notice Emitted for each individual transfer within a distribution.
    /// @param token      Token address (address(0) = ETH).
    /// @param recipient  Address that received the payment.
    /// @param amount     Amount received.
    event PaymentSent(address indexed token, address indexed recipient, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Thrown when the recipient array is empty.
    error EmptyRecipients();

    /// @notice Thrown when the bps values do not sum to exactly 10 000.
    /// @param sum The actual sum that was supplied.
    error BpsSumInvalid(uint256 sum);

    /// @notice Thrown when a recipient address is the zero address.
    /// @param index Position of the offending entry.
    error ZeroRecipient(uint256 index);

    /// @notice Thrown when `amount` is zero.
    error ZeroAmount();

    /// @notice Thrown when a zero-address token is supplied.
    error ZeroToken();

    /// @notice Thrown when an ETH transfer to a recipient fails.
    /// @param recipient  The destination that rejected the ETH.
    error ETHTransferFailed(address recipient);

    /// @notice Thrown when msg.value does not match the `amount` parameter.
    error ValueMismatch();

    // ─────────────────────────────────────────────────────────────────────────
    //  View
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Return the active recipient configuration.
    function getRecipients() external view returns (RecipientConfig[] memory);

    /// @notice Number of configured recipients.
    function recipientCount() external view returns (uint256);

    // ─────────────────────────────────────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Replace the entire recipient configuration.
    ///         Sum of all `bps` values must equal 10 000.
    /// @param configs  New recipient / split configuration.
    function setRecipients(RecipientConfig[] calldata configs) external;

    // ─────────────────────────────────────────────────────────────────────────
    //  Distribution
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Pull `amount` of `token` from msg.sender and distribute it
    ///         proportionally to all recipients.
    /// @param token   ERC20 token to distribute.
    /// @param amount  Total gross amount to distribute.
    function distributeERC20(address token, uint256 amount) external;

    /// @notice Distribute the ETH sent with this call (msg.value) to all
    ///         recipients. msg.value must equal `amount`.
    /// @param amount  Total wei to distribute (must match msg.value).
    function distributeETH(uint256 amount) external payable;
}
