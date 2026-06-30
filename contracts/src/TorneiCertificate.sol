// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title TorneiCertificate
/// @notice ERC-721 dei certificati dei Tornei TraderLoading (Champion / Podio /
///         Finisher). Conio riservato al ruolo MINTER, assegnato al signer della
///         piattaforma. Il tokenURI per-token punta ai metadata ERC-721 serviti
///         dall'API (`/api/tornei/certificates/{id}/metadata`).
/// @dev    L'interfaccia combacia con quella attesa dal client di conio
///         (`services/tornei/mint/onchain.ts`):
///           function safeMint(address to, string uri) returns (uint256)
///         che emette il Transfer ERC-721 standard (da cui il client estrae il tokenId).
contract TorneiCertificate is ERC721, ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId = 1;

    /// @param admin   detentore di DEFAULT_ADMIN_ROLE (può gestire i ruoli)
    /// @param minter  signer della piattaforma autorizzato a coniare
    constructor(address admin, address minter) ERC721("TraderLoading Tornei", "TLT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    /// @notice Conia un certificato a `to` con il `uri` dei metadata.
    /// @return tokenId id incrementale del token coniato.
    function safeMint(address to, string memory uri)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    // ── Override richiesti dall'ereditarietà multipla (OpenZeppelin v5) ──────

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
