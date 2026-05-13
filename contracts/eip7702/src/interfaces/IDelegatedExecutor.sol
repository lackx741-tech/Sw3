// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title  IDelegatedExecutor
/// @notice Public interface for the EIP-7702-style delegated execution router.
///
///         Design
///         ──────
///         An EOA (the "signer") signs an EIP-712 `Authorization` that lists a
///         batch of low-level calls to execute.  A relayer submits the
///         authorization plus signature to `executeDelegated`.  The contract
///         recovers the signer, enforces nonce + deadline replay-protection, and
///         executes the calls with itself as `msg.sender` (meta-tx semantics).
///
///         This follows the *spirit* of EIP-7702 delegation — the signer
///         authorises a specific action without broadcasting their own
///         transaction — while remaining fully compatible with current EVM
///         versions (no new opcodes required).
interface IDelegatedExecutor {
    // ─────────────────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice A single low-level call within a delegated batch.
    /// @param target   Contract or EOA to call.
    /// @param value    Native ETH (wei) to forward with the call.
    /// @param data     ABI-encoded calldata.
    struct Call {
        address target;
        uint256 value;
        bytes   data;
    }

    /// @notice The signed authorization payload.
    /// @param signer   EOA that signs and authorises this batch.
    /// @param nonce    Per-signer nonce — each value may be used only once.
    /// @param deadline Unix timestamp after which the authorization is invalid.
    /// @param calls    Ordered list of calls to execute on behalf of `signer`.
    struct Authorization {
        address signer;
        uint256 nonce;
        uint256 deadline;
        Call[]  calls;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a delegated batch is executed successfully.
    /// @param signer    EOA whose authorization was used.
    /// @param nonce     Nonce consumed by this execution.
    /// @param callCount Number of calls executed.
    event DelegatedExecuted(
        address indexed signer,
        uint256         nonce,
        uint256         callCount
    );

    /// @notice Emitted when a nonce is explicitly invalidated by its owner.
    /// @param owner Owner of the nonce.
    /// @param nonce The invalidated nonce value.
    event NonceInvalidated(address indexed owner, uint256 nonce);

    // ─────────────────────────────────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice The authorization deadline has elapsed.
    /// @param deadline  Submitted timestamp.
    /// @param blockTime Current block.timestamp.
    error DeadlineExpired(uint256 deadline, uint256 blockTime);

    /// @notice The recovered signer does not match `auth.signer`.
    /// @param expected auth.signer.
    /// @param recovered ECDSA-recovered address.
    error InvalidSigner(address expected, address recovered);

    /// @notice The nonce has already been consumed for this signer.
    /// @param signer Signer address.
    /// @param nonce  Replayed nonce.
    error NonceAlreadyUsed(address signer, uint256 nonce);

    /// @notice The authorization carries an empty call list.
    error EmptyCalls();

    /// @notice `auth.signer` is the zero address.
    error ZeroSigner();

    /// @notice One of the call targets is the zero address.
    /// @param callIndex Index of the offending call.
    error ZeroTarget(uint256 callIndex);

    /// @notice A delegated call reverted.
    /// @param callIndex Index of the call that failed.
    /// @param reason    Revert data returned by the failing call.
    error CallReverted(uint256 callIndex, bytes reason);

    /// @notice ETH forwarding mismatch: msg.value < sum of call values.
    /// @param required Sum of all call values.
    /// @param provided msg.value.
    error InsufficientValue(uint256 required, uint256 provided);

    // ─────────────────────────────────────────────────────────────────────────
    //  View / pure
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice EIP-712 domain separator for this contract.
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Returns `true` if `nonce` has been consumed for `signer`.
    function isNonceUsed(address signer, uint256 nonce) external view returns (bool);

    /// @notice Returns the EIP-712 hash of an `Authorization` struct.
    ///         Off-chain tooling calls this to build the payload before signing.
    function hashAuthorization(Authorization calldata auth) external view returns (bytes32);

    // ─────────────────────────────────────────────────────────────────────────
    //  State-changing
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Execute a batch of calls authorised by an EOA signature.
    ///
    ///         Steps
    ///         ─────
    ///         1. Validate deadline.
    ///         2. Hash the authorization (EIP-712).
    ///         3. Recover the signer from `signature`.
    ///         4. Verify recovered == auth.signer.
    ///         5. Mark the nonce as used (replay protection).
    ///         6. Execute auth.calls sequentially.
    ///
    /// @param auth      Signed authorization payload.
    /// @param signature 65-byte ECDSA signature over `hashAuthorization(auth)`.
    function executeDelegated(
        Authorization calldata auth,
        bytes calldata signature
    ) external payable;

    /// @notice Invalidate a nonce for the caller, preventing its future use.
    /// @param nonce The nonce to burn.
    function invalidateNonce(uint256 nonce) external;
}
