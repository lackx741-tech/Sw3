// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script}  from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Sweeper} from "../src/Sweeper.sol";

/// @title  Deploy
/// @notice Foundry deployment script for the Sweeper contract.
///
///         Usage
///         ─────
///         # Dry run (no broadcast)
///         forge script script/Deploy.s.sol --rpc-url $RPC_URL
///
///         # Live broadcast (requires private key)
///         forge script script/Deploy.s.sol \
///             --rpc-url $RPC_URL \
///             --broadcast \
///             --verify \
///             --etherscan-api-key $ETHERSCAN_API_KEY \
///             -vvvv
///
///         Environment variables (set before running)
///         ───────────────────────────────────────────
///         DEPLOYER_PRIVATE_KEY   — Private key of the deploying account.
///         PERMIT2_ADDRESS        — Canonical Permit2 address on the target chain.
///         FEE_RECIPIENT          — Initial protocol fee recipient.
///         FEE_BPS                — Initial fee in basis points (≤ 1 000).
///         ADMIN_ADDRESS          — Address granted DEFAULT_ADMIN_ROLE.
contract Deploy is Script {
    // ─────────────────────────────────────────────────────────────────────────
    //  Canonical Permit2 addresses by chain ID
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Uniswap Permit2 is deployed at the same address on all major EVM
    ///      chains via CREATE2 with a deterministic salt.
    address internal constant PERMIT2_CANONICAL = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // ─────────────────────────────────────────────────────────────────────────
    //  Run
    // ─────────────────────────────────────────────────────────────────────────

    function run() external returns (Sweeper sweeper) {
        // ── Load config from environment ────────────────────────────────────
        uint256 deployerKey   = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address permit2Addr   = vm.envOr("PERMIT2_ADDRESS", PERMIT2_CANONICAL);
        address feeRecipient  = vm.envAddress("FEE_RECIPIENT");
        uint256 feeBps        = vm.envUint("FEE_BPS");
        address adminAddr     = vm.envAddress("ADMIN_ADDRESS");

        // ── Pre-deployment checks ────────────────────────────────────────────
        require(permit2Addr  != address(0), "Deploy: zero permit2");
        require(feeRecipient != address(0), "Deploy: zero feeRecipient");
        require(feeBps       <= 1_000,      "Deploy: feeBps > 1000");
        require(adminAddr    != address(0), "Deploy: zero admin");

        // ── Deploy ───────────────────────────────────────────────────────────
        vm.startBroadcast(deployerKey);

        sweeper = new Sweeper(
            permit2Addr,
            feeRecipient,
            feeBps,
            adminAddr
        );

        vm.stopBroadcast();

        // ── Log ─────────────────────────────────────────────────────────────
        console2.log("Sweeper deployed:");
        console2.log("  address      :", address(sweeper));
        console2.log("  permit2      :", sweeper.permit2());
        console2.log("  feeRecipient :", sweeper.feeRecipient());
        console2.log("  feeBps       :", sweeper.feeBps());
        console2.log("  admin        :", adminAddr);
        console2.log("  chainId      :", block.chainid);
    }
}
