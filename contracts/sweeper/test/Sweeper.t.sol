// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test}         from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {console2}     from "forge-std/console2.sol";

import {Sweeper}    from "../src/Sweeper.sol";
import {ISweeper}   from "../src/interfaces/ISweeper.sol";
import {IPermit2}   from "../src/interfaces/IPermit2.sol";
import {FeeLib}     from "../src/libraries/FeeLib.sol";
import {SweepLib}   from "../src/libraries/SweepLib.sol";

import {ERC20}      from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  Test helpers
// ─────────────────────────────────────────────────────────────────────────────

/// @dev Minimal ERC20 token for tests.
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Minimal Permit2 mock — just records calls; does not validate sigs.
contract MockPermit2 {
    struct PermitCall {
        address owner;
        bytes   sig;
    }

    struct TransferCall {
        address from;
        address to;
        uint160 amount;
        address token;
    }

    PermitCall[]    public permitCalls;
    TransferCall[]  public transferCalls;

    function permit(
        address owner,
        IPermit2.PermitSingle calldata, /* permitSingle */
        bytes calldata signature
    ) external {
        permitCalls.push(PermitCall({owner: owner, sig: signature}));
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        // Actually move tokens so balance assertions work.
        ERC20(token).transferFrom(from, address(msg.sender), amount);
        transferCalls.push(TransferCall({from: from, to: to, amount: amount, token: token}));
    }

    function permitCallCount()   external view returns (uint256) { return permitCalls.length;   }
    function transferCallCount() external view returns (uint256) { return transferCalls.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main test suite
// ─────────────────────────────────────────────────────────────────────────────

/// @title  SweeperTest
/// @notice Forge unit + fuzz + invariant tests for the Sweeper contract.
contract SweeperTest is Test, StdInvariant {
    // ── Constants ─────────────────────────────────────────────────────────────
    uint256 constant DEFAULT_FEE_BPS  = 50;   // 0.5 %
    uint256 constant MAX_FEE_BPS      = 1_000;
    uint256 constant LARGE_DEADLINE   = type(uint256).max;

    // ── Actors ────────────────────────────────────────────────────────────────
    address admin     = makeAddr("admin");
    address operator  = makeAddr("operator");
    address pauser    = makeAddr("pauser");
    address alice     = makeAddr("alice");
    address bob       = makeAddr("bob");
    address treasury  = makeAddr("treasury");

    // ── Contracts ─────────────────────────────────────────────────────────────
    Sweeper     sweeper;
    MockERC20   tokenA;
    MockERC20   tokenB;
    MockPermit2 permit2Mock;

    // ─────────────────────────────────────────────────────────────────────────
    //  Setup
    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        vm.label(admin,    "admin");
        vm.label(operator, "operator");
        vm.label(pauser,   "pauser");
        vm.label(alice,    "alice");
        vm.label(bob,      "bob");
        vm.label(treasury, "treasury");

        tokenA      = new MockERC20("Token A", "TKA");
        tokenB      = new MockERC20("Token B", "TKB");
        permit2Mock = new MockPermit2();

        sweeper = new Sweeper(
            address(permit2Mock),
            treasury,
            DEFAULT_FEE_BPS,
            admin
        );

        // Grant roles.
        vm.startPrank(admin);
        sweeper.grantRole(sweeper.OPERATOR_ROLE(), operator);
        sweeper.grantRole(sweeper.PAUSER_ROLE(),   pauser);
        vm.stopPrank();

        // Seed alice with tokens.
        tokenA.mint(alice, 1_000_000 ether);
        tokenB.mint(alice, 1_000_000 ether);

        // Alice approves sweeper for allowance-based sweeps.
        vm.startPrank(alice);
        tokenA.approve(address(sweeper), type(uint256).max);
        tokenB.approve(address(sweeper), type(uint256).max);
        vm.stopPrank();

        // Target the sweeper for invariant tests.
        targetContract(address(sweeper));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor / initial state
    // ─────────────────────────────────────────────────────────────────────────

    function test_initialState() public view {
        assertEq(sweeper.feeBps(),        DEFAULT_FEE_BPS);
        assertEq(sweeper.feeRecipient(),  treasury);
        assertEq(sweeper.permit2(),       address(permit2Mock));
        assertTrue(sweeper.hasRole(sweeper.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(sweeper.hasRole(sweeper.OPERATOR_ROLE(),      admin));
        assertTrue(sweeper.hasRole(sweeper.OPERATOR_ROLE(),      operator));
        assertTrue(sweeper.hasRole(sweeper.PAUSER_ROLE(),        pauser));
    }

    function test_domainSeparator_notZero() public view {
        assertFalse(sweeper.DOMAIN_SEPARATOR() == bytes32(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor — negative cases
    // ─────────────────────────────────────────────────────────────────────────

    function test_constructor_revertsOnZeroPermit2() public {
        vm.expectRevert(ISweeper.ZeroAddress.selector);
        new Sweeper(address(0), treasury, DEFAULT_FEE_BPS, admin);
    }

    function test_constructor_revertsOnZeroFeeRecipient() public {
        vm.expectRevert(ISweeper.ZeroAddress.selector);
        new Sweeper(address(permit2Mock), address(0), DEFAULT_FEE_BPS, admin);
    }

    function test_constructor_revertsOnZeroAdmin() public {
        vm.expectRevert(ISweeper.ZeroAddress.selector);
        new Sweeper(address(permit2Mock), treasury, DEFAULT_FEE_BPS, address(0));
    }

    function test_constructor_revertsFeeTooHigh() public {
        vm.expectRevert(
            abi.encodeWithSelector(FeeLib.FeeLib__FeeTooHigh.selector, MAX_FEE_BPS + 1, MAX_FEE_BPS)
        );
        new Sweeper(address(permit2Mock), treasury, MAX_FEE_BPS + 1, admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  setFeeBps
    // ─────────────────────────────────────────────────────────────────────────

    function test_setFeeBps_updatesAndEmits() public {
        vm.prank(admin);
        vm.expectEmit(true, true, true, true);
        emit ISweeper.FeeBpsUpdated(DEFAULT_FEE_BPS, 100);
        sweeper.setFeeBps(100);
        assertEq(sweeper.feeBps(), 100);
    }

    function test_setFeeBps_toZero() public {
        vm.prank(admin);
        sweeper.setFeeBps(0);
        assertEq(sweeper.feeBps(), 0);
    }

    function test_setFeeBps_revertsIfTooHigh() public {
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(FeeLib.FeeLib__FeeTooHigh.selector, MAX_FEE_BPS + 1, MAX_FEE_BPS)
        );
        sweeper.setFeeBps(MAX_FEE_BPS + 1);
    }

    function test_setFeeBps_revertsIfNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        sweeper.setFeeBps(100);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  setFeeRecipient
    // ─────────────────────────────────────────────────────────────────────────

    function test_setFeeRecipient_updatesAndEmits() public {
        address newRecipient = makeAddr("newTreasury");
        vm.prank(admin);
        vm.expectEmit(true, true, true, true);
        emit ISweeper.FeeRecipientUpdated(treasury, newRecipient);
        sweeper.setFeeRecipient(newRecipient);
        assertEq(sweeper.feeRecipient(), newRecipient);
    }

    function test_setFeeRecipient_revertsOnZero() public {
        vm.prank(admin);
        vm.expectRevert(ISweeper.ZeroAddress.selector);
        sweeper.setFeeRecipient(address(0));
    }

    function test_setFeeRecipient_revertsIfNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        sweeper.setFeeRecipient(bob);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Pause
    // ─────────────────────────────────────────────────────────────────────────

    function test_pause_preventsSweep() public {
        vm.prank(pauser);
        sweeper.pause();

        ISweeper.SweepLeg[] memory legs = _singleLeg(alice, bob, 1 ether);

        vm.prank(operator);
        vm.expectRevert();
        sweeper.batchSweep(legs, LARGE_DEADLINE);
    }

    function test_unpause_allowsSweep() public {
        vm.prank(pauser);
        sweeper.pause();
        vm.prank(pauser);
        sweeper.unpause();

        ISweeper.SweepLeg[] memory legs = _singleLeg(alice, bob, 1 ether);
        vm.prank(operator);
        sweeper.batchSweep(legs, LARGE_DEADLINE);
    }

    function test_pause_revertsIfNotPauser() public {
        vm.prank(alice);
        vm.expectRevert();
        sweeper.pause();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  batchSweep — happy path
    // ─────────────────────────────────────────────────────────────────────────

    function test_batchSweep_singleLeg() public {
        uint256 amount = 1_000 ether;
        (uint256 fee, uint256 net) = _expectedFeeNet(amount, DEFAULT_FEE_BPS);

        ISweeper.SweepLeg[] memory legs = _singleLeg(alice, bob, amount);

        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit ISweeper.Swept(address(tokenA), alice, bob, amount, fee, net);
        sweeper.batchSweep(legs, LARGE_DEADLINE);

        assertEq(tokenA.balanceOf(bob),      net);
        assertEq(tokenA.balanceOf(treasury), fee);
        assertEq(tokenA.balanceOf(alice),    1_000_000 ether - amount);
    }

    function test_batchSweep_multipleLegs() public {
        uint256 amountA = 500 ether;
        uint256 amountB = 750 ether;

        ISweeper.SweepLeg[] memory legs = new ISweeper.SweepLeg[](2);
        legs[0] = ISweeper.SweepLeg({token: address(tokenA), from: alice, to: bob,    amount: amountA});
        legs[1] = ISweeper.SweepLeg({token: address(tokenB), from: alice, to: operator, amount: amountB});

        vm.prank(operator);
        sweeper.batchSweep(legs, LARGE_DEADLINE);

        (uint256 feeA, uint256 netA) = _expectedFeeNet(amountA, DEFAULT_FEE_BPS);
        (uint256 feeB, uint256 netB) = _expectedFeeNet(amountB, DEFAULT_FEE_BPS);

        assertEq(tokenA.balanceOf(bob),      netA);
        assertEq(tokenB.balanceOf(operator), netB);
        assertEq(tokenA.balanceOf(treasury), feeA);
        assertEq(tokenB.balanceOf(treasury), feeB);
    }

    function test_batchSweep_zeroFee_noFeeTransfer() public {
        vm.prank(admin);
        sweeper.setFeeBps(0);

        uint256 amount = 1_000 ether;
        ISweeper.SweepLeg[] memory legs = _singleLeg(alice, bob, amount);

        uint256 treasuryBefore = tokenA.balanceOf(treasury);
        vm.prank(operator);
        sweeper.batchSweep(legs, LARGE_DEADLINE);

        assertEq(tokenA.balanceOf(bob),      amount);
        assertEq(tokenA.balanceOf(treasury), treasuryBefore); // unchanged
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  batchSweep — negative cases
    // ─────────────────────────────────────────────────────────────────────────

    function test_batchSweep_revertsIfNotOperator() public {
        ISweeper.SweepLeg[] memory legs = _singleLeg(alice, bob, 1 ether);
        vm.prank(alice);
        vm.expectRevert();
        sweeper.batchSweep(legs, LARGE_DEADLINE);
    }

    function test_batchSweep_revertsIfDeadlineExpired() public {
        ISweeper.SweepLeg[] memory legs = _singleLeg(alice, bob, 1 ether);
        vm.prank(operator);
        vm.expectRevert();
        sweeper.batchSweep(legs, block.timestamp - 1);
    }

    function test_batchSweep_revertsOnEmptyLegs() public {
        ISweeper.SweepLeg[] memory legs = new ISweeper.SweepLeg[](0);
        vm.prank(operator);
        vm.expectRevert(SweepLib.SweepLib__EmptyLegs.selector);
        sweeper.batchSweep(legs, LARGE_DEADLINE);
    }

    function test_batchSweep_revertsOnZeroAmount() public {
        ISweeper.SweepLeg[] memory legs = _singleLeg(alice, bob, 0);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SweepLib.SweepLib__ZeroAmount.selector, 0));
        sweeper.batchSweep(legs, LARGE_DEADLINE);
    }

    function test_batchSweep_revertsOnZeroFromAddress() public {
        ISweeper.SweepLeg[] memory legs = new ISweeper.SweepLeg[](1);
        legs[0] = ISweeper.SweepLeg({token: address(tokenA), from: address(0), to: bob, amount: 1 ether});
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SweepLib.SweepLib__ZeroAddress.selector, 0));
        sweeper.batchSweep(legs, LARGE_DEADLINE);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  batchSweepWithPermit2 — happy path
    // ─────────────────────────────────────────────────────────────────────────

    function test_batchSweepWithPermit2_singleLeg() public {
        uint256 amount = 200 ether;

        // Alice approves the MockPermit2 to spend tokenA.
        vm.prank(alice);
        tokenA.approve(address(permit2Mock), type(uint256).max);

        ISweeper.PermitSweepLeg[] memory legs = _singlePermitLeg(alice, bob, amount);

        vm.prank(operator);
        sweeper.batchSweepWithPermit2(legs, LARGE_DEADLINE);

        (uint256 fee, uint256 net) = _expectedFeeNet(amount, DEFAULT_FEE_BPS);
        assertEq(tokenA.balanceOf(bob),      net);
        assertEq(tokenA.balanceOf(treasury), fee);
        assertEq(permit2Mock.permitCallCount(),   1);
        assertEq(permit2Mock.transferCallCount(), 1);
    }

    function test_batchSweepWithPermit2_revertsIfNotOperator() public {
        ISweeper.PermitSweepLeg[] memory legs = _singlePermitLeg(alice, bob, 1 ether);
        vm.prank(alice);
        vm.expectRevert();
        sweeper.batchSweepWithPermit2(legs, LARGE_DEADLINE);
    }

    function test_batchSweepWithPermit2_revertsIfDeadlineExpired() public {
        ISweeper.PermitSweepLeg[] memory legs = _singlePermitLeg(alice, bob, 1 ether);
        vm.prank(operator);
        vm.expectRevert();
        sweeper.batchSweepWithPermit2(legs, block.timestamp - 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  rescueERC20
    // ─────────────────────────────────────────────────────────────────────────

    function test_rescueERC20_transfersTokens() public {
        // Simulate tokens stuck in contract.
        tokenA.mint(address(sweeper), 500 ether);

        uint256 before = tokenA.balanceOf(admin);
        vm.prank(admin);
        sweeper.rescueERC20(address(tokenA), admin, 500 ether);
        assertEq(tokenA.balanceOf(admin), before + 500 ether);
    }

    function test_rescueERC20_emitsEvent() public {
        tokenA.mint(address(sweeper), 1 ether);
        vm.prank(admin);
        vm.expectEmit(true, true, true, true);
        emit ISweeper.ERC20Rescued(address(tokenA), admin, 1 ether);
        sweeper.rescueERC20(address(tokenA), admin, 1 ether);
    }

    function test_rescueERC20_revertsOnZeroToken() public {
        vm.prank(admin);
        vm.expectRevert(ISweeper.InvalidRescueToken.selector);
        sweeper.rescueERC20(address(0), admin, 1 ether);
    }

    function test_rescueERC20_revertsIfNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        sweeper.rescueERC20(address(tokenA), alice, 1 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  rescueETH
    // ─────────────────────────────────────────────────────────────────────────

    function test_rescueETH_transfersEth() public {
        vm.deal(address(sweeper), 1 ether);
        uint256 before = admin.balance;
        vm.prank(admin);
        sweeper.rescueETH(payable(admin), 1 ether);
        assertEq(admin.balance, before + 1 ether);
    }

    function test_rescueETH_emitsEvent() public {
        vm.deal(address(sweeper), 1 ether);
        vm.prank(admin);
        vm.expectEmit(true, true, true, true);
        emit ISweeper.ETHRescued(admin, 1 ether);
        sweeper.rescueETH(payable(admin), 1 ether);
    }

    function test_rescueETH_revertsOnZeroAddress() public {
        vm.deal(address(sweeper), 1 ether);
        vm.prank(admin);
        vm.expectRevert(ISweeper.ZeroAddress.selector);
        sweeper.rescueETH(payable(address(0)), 1 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Fuzz tests
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Sweep with arbitrary amount and recipient.
    function testFuzz_batchSweep_amount(uint256 amount, address recipient) public {
        vm.assume(amount > 0 && amount <= 1_000_000 ether);
        vm.assume(recipient != address(0));
        vm.assume(recipient != address(sweeper));
        vm.assume(recipient != treasury);

        tokenA.mint(alice, amount);

        ISweeper.SweepLeg[] memory legs = new ISweeper.SweepLeg[](1);
        legs[0] = ISweeper.SweepLeg({token: address(tokenA), from: alice, to: recipient, amount: amount});

        vm.prank(operator);
        sweeper.batchSweep(legs, LARGE_DEADLINE);

        (uint256 fee, uint256 net) = _expectedFeeNet(amount, DEFAULT_FEE_BPS);
        assertEq(tokenA.balanceOf(recipient), net);
        assertEq(tokenA.balanceOf(treasury),  fee);
    }

    /// @dev Ensure fee never exceeds the gross amount regardless of bps.
    function testFuzz_feeNeverExceedsAmount(uint256 amount, uint256 bps) public pure {
        bps    = bound(bps,    0,      FeeLib.MAX_FEE_BPS);
        amount = bound(amount, 0,      type(uint128).max);

        (uint256 fee, uint256 net) = FeeLib.split(amount, bps);
        assertLe(fee, amount);
        assertEq(fee + net, amount);
    }

    /// @dev Fuzz the fee bps setter.
    function testFuzz_setFeeBps(uint256 bps) public {
        bps = bound(bps, 0, FeeLib.MAX_FEE_BPS);
        vm.prank(admin);
        sweeper.setFeeBps(bps);
        assertEq(sweeper.feeBps(), bps);
    }

    /// @dev Fuzz over-limit bps always reverts.
    function testFuzz_setFeeBps_revertsAboveMax(uint256 bps) public {
        bps = bound(bps, FeeLib.MAX_FEE_BPS + 1, type(uint256).max);
        vm.prank(admin);
        vm.expectRevert();
        sweeper.setFeeBps(bps);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Invariants
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice feeBps must never exceed MAX_FEE_BPS.
    function invariant_feeBpsNeverExceedsMax() public view {
        assertLe(sweeper.feeBps(), FeeLib.MAX_FEE_BPS);
    }

    /// @notice feeRecipient must never be zero.
    function invariant_feeRecipientNeverZero() public view {
        assertFalse(sweeper.feeRecipient() == address(0));
    }

    /// @notice permit2 address is immutable.
    function invariant_permit2IsImmutable() public view {
        assertEq(sweeper.permit2(), address(permit2Mock));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _singleLeg(address from, address to, uint256 amount)
        internal
        view
        returns (ISweeper.SweepLeg[] memory legs)
    {
        legs    = new ISweeper.SweepLeg[](1);
        legs[0] = ISweeper.SweepLeg({token: address(tokenA), from: from, to: to, amount: amount});
    }

    function _singlePermitLeg(address from, address to, uint256 amount)
        internal
        view
        returns (ISweeper.PermitSweepLeg[] memory legs)
    {
        IPermit2.PermitDetails memory details = IPermit2.PermitDetails({
            token:      address(tokenA),
            amount:     uint160(amount),
            expiration: uint48(LARGE_DEADLINE),
            nonce:      0
        });
        IPermit2.PermitSingle memory permitSingle = IPermit2.PermitSingle({
            details:      details,
            spender:      address(sweeper),
            sigDeadline:  LARGE_DEADLINE
        });

        legs    = new ISweeper.PermitSweepLeg[](1);
        legs[0] = ISweeper.PermitSweepLeg({
            leg:       ISweeper.SweepLeg({token: address(tokenA), from: from, to: to, amount: amount}),
            permit:    permitSingle,
            signature: hex"deadbeef"
        });
    }

    function _expectedFeeNet(uint256 amount, uint256 bps)
        internal
        pure
        returns (uint256 fee, uint256 net)
    {
        (fee, net) = FeeLib.split(amount, bps);
    }
}
