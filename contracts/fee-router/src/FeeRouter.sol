// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IFeeRouter} from "./interfaces/IFeeRouter.sol";

/// @title  FeeRouter
/// @author Sw3 Protocol
/// @notice Distributes ERC20 tokens and native ETH across multiple fee
///         recipients according to administrator-configured basis-point splits.
///
///         Design notes
///         ────────────
///         • Splits are stored as a dynamic array; updating them is an
///           all-or-nothing replace to keep the invariant `Σ bps == 10 000`.
///         • Distributions are pull-based for ERC20 (caller approves, router
///           pulls) and push-based for ETH (caller sends with the tx).
///         • Dust from rounding is automatically credited to the LAST recipient
///           so total distributed always equals `amount`.
///         • SafeERC20 for all token transfers.
///         • ReentrancyGuard on all state-changing external functions.
///
/// @custom:security-contact security@sw3.io
contract FeeRouter is IFeeRouter, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    //  Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant BPS_TOTAL = 10_000;

    // ─────────────────────────────────────────────────────────────────────────
    //  Storage
    // ─────────────────────────────────────────────────────────────────────────

    RecipientConfig[] private _recipients;

    /// @dev Reserved storage for future upgrades.
    uint256[49] private __gap;

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Deploy FeeRouter with an initial recipient configuration.
    /// @param initialConfigs  Initial splits; must sum to 10 000.
    /// @param admin           Address granted DEFAULT_ADMIN_ROLE.
    constructor(RecipientConfig[] memory initialConfigs, address admin) {
        if (admin == address(0)) revert ZeroRecipient(0);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _setRecipients(initialConfigs);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IFeeRouter
    function setRecipients(RecipientConfig[] calldata configs)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setRecipients(configs);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  View
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IFeeRouter
    function getRecipients() external view override returns (RecipientConfig[] memory) {
        return _recipients;
    }

    /// @inheritdoc IFeeRouter
    function recipientCount() external view override returns (uint256) {
        return _recipients.length;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Distribution — ERC20
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IFeeRouter
    function distributeERC20(address token, uint256 amount)
        external
        override
        nonReentrant
    {
        if (token  == address(0)) revert ZeroToken();
        if (amount == 0)          revert ZeroAmount();

        IERC20 erc20 = IERC20(token);

        // Pull the full amount from the caller in a single transfer.
        erc20.safeTransferFrom(msg.sender, address(this), amount);

        RecipientConfig[] storage configs = _recipients;
        uint256 len       = configs.length;
        uint256 remaining = amount;

        for (uint256 i; i < len;) {
            uint256 share;

            if (i == len - 1) {
                // Last recipient receives all remaining dust.
                share     = remaining;
                remaining = 0;
            } else {
                unchecked {
                    share     = (amount * configs[i].bps) / BPS_TOTAL;
                    remaining -= share;
                }
            }

            if (share > 0) {
                erc20.safeTransfer(configs[i].recipient, share);
                emit PaymentSent(token, configs[i].recipient, share);
            }

            unchecked { ++i; }
        }

        emit ERC20Distributed(token, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Distribution — ETH
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc IFeeRouter
    function distributeETH(uint256 amount)
        external
        payable
        override
        nonReentrant
    {
        if (amount == 0)          revert ZeroAmount();
        if (msg.value != amount)  revert ValueMismatch();

        RecipientConfig[] storage configs = _recipients;
        uint256 len       = configs.length;
        uint256 remaining = amount;

        for (uint256 i; i < len;) {
            uint256 share;

            if (i == len - 1) {
                share     = remaining;
                remaining = 0;
            } else {
                unchecked {
                    share     = (amount * configs[i].bps) / BPS_TOTAL;
                    remaining -= share;
                }
            }

            if (share > 0) {
                (bool ok,) = configs[i].recipient.call{value: share}("");
                if (!ok) revert ETHTransferFailed(configs[i].recipient);
                emit PaymentSent(address(0), configs[i].recipient, share);
            }

            unchecked { ++i; }
        }

        emit ETHDistributed(amount);
    }

    /// @dev Allow the contract to receive ETH (e.g. from wETH unwraps).
    receive() external payable {}

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Validate and replace the stored recipient configuration.
    function _setRecipients(RecipientConfig[] memory configs) private {
        uint256 len = configs.length;
        if (len == 0) revert EmptyRecipients();

        uint256 sum;
        for (uint256 i; i < len;) {
            if (configs[i].recipient == address(0)) revert ZeroRecipient(i);
            unchecked {
                sum += configs[i].bps;
                ++i;
            }
        }
        if (sum != BPS_TOTAL) revert BpsSumInvalid(sum);

        // Clear old array and write new one.
        delete _recipients;
        for (uint256 i; i < len;) {
            _recipients.push(configs[i]);
            unchecked { ++i; }
        }

        bytes32 configHash = keccak256(abi.encode(configs));
        emit RecipientsUpdated(configHash, configs);
    }
}
