// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TorneiCertificate} from "../src/TorneiCertificate.sol";

/// @notice Deploy di TorneiCertificate. Legge da env:
///   PRIVATE_KEY     chiave del deployer (paga il gas)
///   ADMIN_ADDRESS   detentore di DEFAULT_ADMIN_ROLE
///   MINTER_ADDRESS  signer della piattaforma (= TORNEI_MINT_SIGNER_KEY lato API)
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address minter = vm.envAddress("MINTER_ADDRESS");

        vm.startBroadcast(deployerKey);
        TorneiCertificate cert = new TorneiCertificate(admin, minter);
        vm.stopBroadcast();

        console.log("TorneiCertificate deployed at:", address(cert));
        console.log("  admin :", admin);
        console.log("  minter:", minter);
    }
}
