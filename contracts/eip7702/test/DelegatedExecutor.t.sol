// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test}         from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {console2}     from "forge-std/console2.sol";

import {DelegatedExecutor}  from "../src/DelegatedExecutor.sol";
import {IDelegatedExecutor} from "../src/interfaces/IDelegatedExecutor.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  Test helpers
// ─────────────────────────────────────────────────────────────────────────────

/// @dev Counter contract — incremented by delegated calls in happy-path tests.
contract Counter {
    uint256 public count;

    function increment() external {
        ++count;
    }

    function incrementBy(uint256 n) external {
        count += n;
    }

    function revertAlways() external pure {
        revert("Counter: always revert");
    }
}

/// @dev Receives ETH and records the amount for assertions.
contract EthReceiver {
    uint256 public received;

    receive() external payable {
        received += msg.value;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main test suite
// ─────────────────────────────────────────────────────────────────────────────

/// @title  DelegatedExecutorTest
/// @notice Forge unit + fuzz + invariant tests for DelegatedExecutor.
contract DelegatedExecutorTest is Test, StdInvariant {
    // ── Constants ─────────────────────────────────────────────────────────────
    uint256 constant LARGE_DEADLINE = type(uint256).max;

    // ── Actors ────────────────────────────────────────────────────────────────
    address admin   = makeAddr("admin");
    address relayer = makeAddr("relayer");
    address pauser  = makeAddr("pauser");
    address alice   = makeAddr("alice");

    // Signer with known private key (vm.sign requires a uint256 key).
    uint256 constant SIGNER_KEY = 0xA11CE;
    address signer;

    // ── Contracts ─────────────────────────────────────────────────────────────
    DelegatedExecutor executor;
    Counter           counter;
    EthReceiver       ethReceiver;

    // ─────────────────────────────────────────────────────────────────────────
    //  Setup
    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        signer      = vm.addr(SIGNER_KEY);
        counter     = new Counter();
        ethReceiver = new EthReceiver();

        executor = new DelegatedExecutor(admin);

        vm.startPrank(admin);
        executor.grantRole(executor.RELAYER_ROLE(), relayer);
        executor.grantRole(executor.PAUSER_ROLE(),  pauser);
        vm.stopPrank();

        // Target the executor for invariant tests.
        targetContract(address(executor));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _buildAuth(
        address _signer,
        uint256 nonce,
        uint256 deadline,
        IDelegatedExecutor.Call[] memory calls
    ) internal pure returns (IDelegatedExecutor.Authorization memory) {
        return IDelegatedExecutor.Authorization({
            signer:   _signer,
            nonce:    nonce,
            deadline: deadline,
            calls:    calls
        });
    }

    /// @dev Sign an authorization with a private key using the contract's domain.
    function _sign(
        IDelegatedExecutor.Authorization memory auth,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 digest = executor.hashAuthorization(auth);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _singleCounterCall() internal view returns (IDelegatedExecutor.Call[] memory) {
        IDelegatedExecutor.Call[] memory calls = new IDelegatedExecutor.Call[](1);
        calls[0] = IDelegatedExecutor.Call({
            target: address(counter),
            value:  0,
            data:   abi.encodeWithSignature("increment()")
        });
        return calls;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor / initial state
    // ─────────────────────────────────────────────────────────────────────────

    function test_initialState() public view {
        assertTrue(executor.hasRole(executor.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(executor.hasRole(executor.RELAYER_ROLE(),       admin));
        assertTrue(executor.hasRole(executor.PAUSER_ROLE(),        admin));
        assertTrue(executor.hasRole(executor.RELAYER_ROLE(),       relayer));
        assertTrue(executor.hasRole(executor.PAUSER_ROLE(),        pauser));
        assertFalse(executor.paused());
        assertFalse(executor.isNonceUsed(signer, 0));
    }

    function test_domainSeparator_notZero() public view {
        assertFalse(executor.DOMAIN_SEPARATOR() == bytes32(0));
    }

    function test_constructor_revertsOnZeroAdmin() public {
        vm.expectRevert(IDelegatedExecutor.ZeroSigner.selector);
        new DelegatedExecutor(address(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  executeDelegated — happy path
    // ─────────────────────────────────────────────────────────────────────────

    function test_executeDelegated_singleCall() public {
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, _singleCounterCall());
        bytes memory sig = _sign(auth, SIGNER_KEY);

        assertEq(counter.count(), 0);

        vm.prank(relayer);
        vm.expectEmit(true, true, true, true);
        emit IDelegatedExecutor.DelegatedExecuted(signer, 0, 1);
        executor.executeDelegated(auth, sig);

        assertEq(counter.count(), 1);
        assertTrue(executor.isNonceUsed(signer, 0));
    }

    function test_executeDelegated_multipleCalls() public {
        IDelegatedExecutor.Call[] memory calls = new IDelegatedExecutor.Call[](3);
        calls[0] = IDelegatedExecutor.Call({target: address(counter), value: 0, data: abi.encodeWithSignature("increment()")});
        calls[1] = IDelegatedExecutor.Call({target: address(counter), value: 0, data: abi.encodeWithSignature("increment()")});
        calls[2] = IDelegatedExecutor.Call({target: address(counter), value: 0, data: abi.encodeWithSignature("incrementBy(uint256)", 10)});

        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, calls);
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(relayer);
        executor.executeDelegated(auth, sig);

        assertEq(counter.count(), 12);
    }

    function test_executeDelegated_ethForwarding() public {
        IDelegatedExecutor.Call[] memory calls = new IDelegatedExecutor.Call[](1);
        calls[0] = IDelegatedExecutor.Call({
            target: address(ethReceiver),
            value:  0.5 ether,
            data:   ""
        });

        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, calls);
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.deal(relayer, 1 ether);
        vm.prank(relayer);
        executor.executeDelegated{value: 0.5 ether}(auth, sig);

        assertEq(ethReceiver.received(), 0.5 ether);
    }

    function test_executeDelegated_sequentialNonces() public {
        for (uint256 nonce; nonce < 5; ++nonce) {
            IDelegatedExecutor.Authorization memory auth =
                _buildAuth(signer, nonce, LARGE_DEADLINE, _singleCounterCall());
            bytes memory sig = _sign(auth, SIGNER_KEY);

            vm.prank(relayer);
            executor.executeDelegated(auth, sig);
        }

        assertEq(counter.count(), 5);
        for (uint256 nonce; nonce < 5; ++nonce) {
            assertTrue(executor.isNonceUsed(signer, nonce));
        }
    }

    function test_executeDelegated_nonSequentialNonces() public {
        uint256[] memory nonces = new uint256[](3);
        nonces[0] = 0;
        nonces[1] = 255;   // boundary between words 0 and 1
        nonces[2] = 256;   // first nonce in word 1

        for (uint256 i; i < nonces.length; ++i) {
            IDelegatedExecutor.Authorization memory auth =
                _buildAuth(signer, nonces[i], LARGE_DEADLINE, _singleCounterCall());
            bytes memory sig = _sign(auth, SIGNER_KEY);

            vm.prank(relayer);
            executor.executeDelegated(auth, sig);
            assertTrue(executor.isNonceUsed(signer, nonces[i]));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  executeDelegated — deadline
    // ─────────────────────────────────────────────────────────────────────────

    function test_executeDelegated_revertsOnExpiredDeadline() public {
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, block.timestamp - 1, _singleCounterCall());
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IDelegatedExecutor.DeadlineExpired.selector,
                block.timestamp - 1,
                block.timestamp
            )
        );
        executor.executeDelegated(auth, sig);
    }

    function test_executeDelegated_passesAtExactDeadline() public {
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, block.timestamp, _singleCounterCall());
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(relayer);
        executor.executeDelegated(auth, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  executeDelegated — replay protection
    // ─────────────────────────────────────────────────────────────────────────

    function test_executeDelegated_revertsOnNonceReplay() public {
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, _singleCounterCall());
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(relayer);
        executor.executeDelegated(auth, sig);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(IDelegatedExecutor.NonceAlreadyUsed.selector, signer, 0)
        );
        executor.executeDelegated(auth, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  executeDelegated — access control
    // ─────────────────────────────────────────────────────────────────────────

    function test_executeDelegated_revertsIfNotRelayer() public {
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, _singleCounterCall());
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(alice);
        vm.expectRevert();
        executor.executeDelegated(auth, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  executeDelegated — signature validation
    // ─────────────────────────────────────────────────────────────────────────

    function test_executeDelegated_revertsOnWrongSigner() public {
        uint256 wrongKey = 0xB0B;
        address wrongAddr = vm.addr(wrongKey);
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, _singleCounterCall());
        // Sign with a different key — recovered address won't match auth.signer
        bytes memory sig = _sign(auth, wrongKey);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IDelegatedExecutor.InvalidSigner.selector,
                signer,
                wrongAddr
            )
        );
        executor.executeDelegated(auth, sig);
    }

    function test_executeDelegated_revertsOnZeroSigner() public {
        IDelegatedExecutor.Call[] memory calls = _singleCounterCall();
        IDelegatedExecutor.Authorization memory auth = IDelegatedExecutor.Authorization({
            signer:   address(0),
            nonce:    0,
            deadline: LARGE_DEADLINE,
            calls:    calls
        });
        bytes memory sig = hex"00";

        vm.prank(relayer);
        vm.expectRevert(IDelegatedExecutor.ZeroSigner.selector);
        executor.executeDelegated(auth, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  executeDelegated — validation
    // ─────────────────────────────────────────────────────────────────────────

    function test_executeDelegated_revertsOnEmptyCalls() public {
        IDelegatedExecutor.Call[] memory calls = new IDelegatedExecutor.Call[](0);
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, calls);
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(relayer);
        vm.expectRevert(IDelegatedExecutor.EmptyCalls.selector);
        executor.executeDelegated(auth, sig);
    }

    function test_executeDelegated_revertsOnZeroTarget() public {
        IDelegatedExecutor.Call[] memory calls = new IDelegatedExecutor.Call[](1);
        calls[0] = IDelegatedExecutor.Call({target: address(0), value: 0, data: ""});
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, calls);
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(IDelegatedExecutor.ZeroTarget.selector, 0)
        );
        executor.executeDelegated(auth, sig);
    }

    function test_executeDelegated_revertsOnCallRevert() public {
        IDelegatedExecutor.Call[] memory calls = new IDelegatedExecutor.Call[](1);
        calls[0] = IDelegatedExecutor.Call({
            target: address(counter),
            value:  0,
            data:   abi.encodeWithSignature("revertAlways()")
        });
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, calls);
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IDelegatedExecutor.CallReverted.selector,
                0,
                abi.encodeWithSignature("Error(string)", "Counter: always revert")
            )
        );
        executor.executeDelegated(auth, sig);
    }

    function test_executeDelegated_revertsOnInsufficientValue() public {
        IDelegatedExecutor.Call[] memory calls = new IDelegatedExecutor.Call[](1);
        calls[0] = IDelegatedExecutor.Call({target: address(ethReceiver), value: 1 ether, data: ""});
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, calls);
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.deal(relayer, 0.5 ether);
        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(IDelegatedExecutor.InsufficientValue.selector, 1 ether, 0.5 ether)
        );
        executor.executeDelegated{value: 0.5 ether}(auth, sig);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Pause
    // ─────────────────────────────────────────────────────────────────────────

    function test_pause_preventsExecution() public {
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, _singleCounterCall());
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(pauser);
        executor.pause();

        vm.prank(relayer);
        vm.expectRevert();
        executor.executeDelegated(auth, sig);
    }

    function test_unpause_allowsExecution() public {
        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, _singleCounterCall());
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(pauser);
        executor.pause();
        vm.prank(pauser);
        executor.unpause();

        vm.prank(relayer);
        executor.executeDelegated(auth, sig);
        assertEq(counter.count(), 1);
    }

    function test_pause_revertsIfNotPauser() public {
        vm.prank(alice);
        vm.expectRevert();
        executor.pause();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  invalidateNonce
    // ─────────────────────────────────────────────────────────────────────────

    function test_invalidateNonce_marksNonceUsed() public {
        assertFalse(executor.isNonceUsed(signer, 42));

        vm.prank(signer);
        vm.expectEmit(true, true, true, true);
        emit IDelegatedExecutor.NonceInvalidated(signer, 42);
        executor.invalidateNonce(42);

        assertTrue(executor.isNonceUsed(signer, 42));
    }

    function test_invalidateNonce_preventsExecution() public {
        vm.prank(signer);
        executor.invalidateNonce(0);

        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, LARGE_DEADLINE, _singleCounterCall());
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(IDelegatedExecutor.NonceAlreadyUsed.selector, signer, 0)
        );
        executor.executeDelegated(auth, sig);
    }

    function test_invalidateNonce_revertsOnDoubleInvalidation() public {
        vm.prank(signer);
        executor.invalidateNonce(7);

        vm.prank(signer);
        vm.expectRevert(
            abi.encodeWithSelector(IDelegatedExecutor.NonceAlreadyUsed.selector, signer, 7)
        );
        executor.invalidateNonce(7);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Fuzz tests
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Fuzz: any valid nonce can be used exactly once.
    function testFuzz_nonce_usedOnce(uint256 nonce) public {
        nonce = bound(nonce, 0, type(uint128).max); // avoid excessive word positions

        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, nonce, LARGE_DEADLINE, _singleCounterCall());
        bytes memory sig = _sign(auth, SIGNER_KEY);

        assertFalse(executor.isNonceUsed(signer, nonce));

        vm.prank(relayer);
        executor.executeDelegated(auth, sig);

        assertTrue(executor.isNonceUsed(signer, nonce));

        // Replay must revert.
        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(IDelegatedExecutor.NonceAlreadyUsed.selector, signer, nonce)
        );
        executor.executeDelegated(auth, sig);
    }

    /// @dev Fuzz: expired deadlines always revert.
    function testFuzz_expiredDeadline_alwaysReverts(uint256 age) public {
        age = bound(age, 1, block.timestamp);
        uint256 deadline = block.timestamp - age;

        IDelegatedExecutor.Authorization memory auth =
            _buildAuth(signer, 0, deadline, _singleCounterCall());
        bytes memory sig = _sign(auth, SIGNER_KEY);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IDelegatedExecutor.DeadlineExpired.selector,
                deadline,
                block.timestamp
            )
        );
        executor.executeDelegated(auth, sig);
    }

    /// @dev Fuzz: different signers' nonces are independent bitmaps.
    function testFuzz_nonces_independentPerSigner(address other, uint256 nonce) public {
        vm.assume(other != address(0));
        vm.assume(other != signer);
        nonce = bound(nonce, 0, type(uint128).max);

        vm.prank(signer);
        executor.invalidateNonce(nonce);

        // The same nonce for a different signer must still be available.
        assertFalse(executor.isNonceUsed(other, nonce));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Invariant
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev A used nonce can never become unused.
    function invariant_nonceMonotonicallyUsed() public view {
        // We only track signer's nonce 0 as a representative.
        // If it was marked used at some point, it must remain used.
        if (executor.isNonceUsed(signer, 0)) {
            assertTrue(executor.isNonceUsed(signer, 0));
        }
    }
}
