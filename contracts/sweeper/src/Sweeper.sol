// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712}          from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import {ISweeper}  from "./interfaces/ISweeper.sol";
import {IPermit2}  from "./interfaces/IPermit2.sol";
import {FeeLib}    from "./libraries/FeeLib.sol";
import {SweepLib}  from "./libraries/SweepLib.sol";

/// @title  Sweeper
/// @author Sw3 Protocol
/// @notice Production ERC20 batch-sweep contract.
///
///         Key features
///         ─────────────
///         • Batch allowance-based and Permit2-based sweeps in a single tx.
///         • Configurable fee in basis points (max 10 %, hard-coded cap).
///         • Role-based access: OPERATOR_ROLE for sweeps, PAUSER_ROLE for
///           emergency pause, DEFAULT_ADMIN_ROLE for config changes.
///         • Pausable, ReentrancyGuard, SafeERC20.
///         • EIP-712 domain separator exposed for off-chain tooling.
///         • Upgrade-safe storage gaps.
///         • Gas-optimised: calldata arrays, unchecked loop increments,
///           via_ir + optimizer_runs=1_000_000.
///
/// @custom:security-contact security@sw3.io
contract Sweeper is ISweeper, AccessControl, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    //  Role constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Role required to call batchSweep / batchSweepWithPermit2.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Role allowed to pause / unpause the contract.
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    //  Immutables
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISweeper
    address public immutable override permit2;

    // ─────────────────────────────────────────────────────────────────────────
    //  Storage
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISweeper
    uint256 public override feeBps;

    /// @inheritdoc ISweeper
    address public override feeRecipient;

    /// @dev Reserved storage slots for future upgrades (proxy pattern safety).
    ///      Reduce this number by 1 for each new storage variable added above.
    uint256[48] private __gap;

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Deploy the Sweeper contract.
    /// @param _permit2       Address of the canonical Permit2 deployment.
    /// @param _feeRecipient  Initial fee recipient; must be non-zero.
    /// @param _feeBps        Initial fee in basis points; must be ≤ 1 000.
    /// @param _admin         Address granted DEFAULT_ADMIN_ROLE.
    constructor(
        address _permit2,
        address _feeRecipient,
        uint256 _feeBps,
        address _admin
    )
        EIP712("Sweeper", "1")
    {
        if (_permit2      == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_admin        == address(0)) revert ZeroAddress();

        FeeLib.validateBps(_feeBps);

        permit2      = _permit2;
        feeRecipient = _feeRecipient;
        feeBps       = _feeBps;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE,      _admin);
        _grantRole(PAUSER_ROLE,        _admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Receive ETH (required for rescueETH to work)
    // ─────────────────────────────────────────────────────────────────────────

    receive() external payable {}

    // ─────────────────────────────────────────────────────────────────────────
    //  EIP-712
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISweeper
    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Admin — configuration
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISweeper
    /// @dev Restricted to DEFAULT_ADMIN_ROLE.
    function setFeeBps(uint256 newBps)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        FeeLib.validateBps(newBps);
        uint256 old = feeBps;
        feeBps = newBps;
        emit FeeBpsUpdated(old, newBps);
    }

    /// @inheritdoc ISweeper
    /// @dev Restricted to DEFAULT_ADMIN_ROLE.
    function setFeeRecipient(address newRecipient)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newRecipient == address(0)) revert ZeroAddress();
        address old = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(old, newRecipient);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Pause controls
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Pause all sweep operations.
    /// @dev    Requires PAUSER_ROLE.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpause sweep operations.
    /// @dev    Requires PAUSER_ROLE.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Sweeps — allowance-based
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISweeper
    function batchSweep(SweepLeg[] calldata legs, uint256 deadline)
        external
        override
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        SweepLib.checkDeadline(deadline);
        SweepLib.validateLegs(legs);

        uint256 _feeBps        = feeBps;        // cache SLOAD
        address _feeRecipient  = feeRecipient;  // cache SLOAD
        uint256 len            = legs.length;

        for (uint256 i; i < len;) {
            _executeLeg(legs[i], _feeBps, _feeRecipient);
            unchecked { ++i; }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Sweeps — Permit2-based
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISweeper
    function batchSweepWithPermit2(PermitSweepLeg[] calldata legs, uint256 deadline)
        external
        override
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        SweepLib.checkDeadline(deadline);
        SweepLib.validatePermitLegs(legs);

        uint256 _feeBps        = feeBps;
        address _feeRecipient  = feeRecipient;
        uint256 len            = legs.length;
        IPermit2 _permit2      = IPermit2(permit2);

        for (uint256 i; i < len;) {
            PermitSweepLeg calldata psl = legs[i];

            // Submit the Permit2 signed permit first so the allowance is live.
            _permit2.permit(psl.leg.from, psl.permit, psl.signature);

            // Execute the actual transfer via Permit2.
            _executePermit2Leg(psl.leg, _feeBps, _feeRecipient, _permit2);

            unchecked { ++i; }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Emergency recovery
    // ─────────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISweeper
    function rescueERC20(address token, address to, uint256 amount)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        if (token == address(0)) revert InvalidRescueToken();
        if (to    == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit ERC20Rescued(token, to, amount);
    }

    /// @inheritdoc ISweeper
    function rescueETH(address payable to, uint256 amount)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: amount}("");
        require(ok, "ETH transfer failed");
        emit ETHRescued(to, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Execute a single allowance-based sweep leg.
    function _executeLeg(
        SweepLeg calldata leg,
        uint256 _feeBps,
        address _feeRecipient
    ) internal {
        (uint256 fee, uint256 net) = FeeLib.split(leg.amount, _feeBps);

        IERC20 token = IERC20(leg.token);

        // Pull gross amount from the source.
        token.safeTransferFrom(leg.from, address(this), leg.amount);

        // Distribute.
        if (fee > 0) token.safeTransfer(_feeRecipient, fee);
        token.safeTransfer(leg.to, net);

        emit Swept(leg.token, leg.from, leg.to, leg.amount, fee, net);
    }

    /// @dev Execute a single Permit2-based sweep leg (permit already submitted).
    function _executePermit2Leg(
        SweepLeg calldata leg,
        uint256 _feeBps,
        address _feeRecipient,
        IPermit2 _permit2
    ) internal {
        (uint256 fee, uint256 net) = FeeLib.split(leg.amount, _feeBps);

        // Pull gross amount through Permit2 directly into this contract.
        _permit2.transferFrom(leg.from, address(this), uint160(leg.amount), leg.token);

        IERC20 token = IERC20(leg.token);

        // Distribute.
        if (fee > 0) token.safeTransfer(_feeRecipient, fee);
        token.safeTransfer(leg.to, net);

        emit Swept(leg.token, leg.from, leg.to, leg.amount, fee, net);
    }
}
