// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TorneiCertificate} from "../src/TorneiCertificate.sol";

contract TorneiCertificateTest is Test {
    TorneiCertificate internal cert;
    address internal admin = address(0xA11CE);
    address internal minter = address(0xB0B);
    address internal user = address(0xCAFE);

    function setUp() public {
        cert = new TorneiCertificate(admin, minter);
    }

    function test_MinterMintsAndSetsURI() public {
        vm.prank(minter);
        uint256 id = cert.safeMint(user, "ipfs://meta1");
        assertEq(id, 1);
        assertEq(cert.ownerOf(1), user);
        assertEq(cert.tokenURI(1), "ipfs://meta1");
    }

    function test_TokenIdsIncrement() public {
        vm.startPrank(minter);
        uint256 a = cert.safeMint(user, "u1");
        uint256 b = cert.safeMint(user, "u2");
        vm.stopPrank();
        assertEq(a, 1);
        assertEq(b, 2);
    }

    function test_NonMinterCannotMint() public {
        vm.expectRevert();
        vm.prank(user);
        cert.safeMint(user, "u1");
    }

    function test_AdminCanGrantMinter() public {
        vm.prank(admin);
        cert.grantRole(cert.MINTER_ROLE(), user);
        vm.prank(user);
        uint256 id = cert.safeMint(user, "u1");
        assertEq(id, 1);
    }
}
