// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {DelegatedExecutor} from "../src/DelegatedExecutor.sol";

/// @title Deploy
/// @notice Foundry deployment script for DelegatedExecutor.
contract Deploy is Script {
    function run() external returns (DelegatedExecutor delegatedExecutor) {
        address admin = vm.envAddress("ADMIN_ADDRESS");

        vm.startBroadcast();
        delegatedExecutor = new DelegatedExecutor(admin);
        vm.stopBroadcast();

        console2.log("DelegatedExecutor deployed at:", address(delegatedExecutor));
        console2.log("Admin:", admin);
    }
}
