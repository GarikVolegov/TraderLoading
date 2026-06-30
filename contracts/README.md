# TorneiCertificate — ERC-721 dei certificati Tornei

Smart contract ERC-721 minimale per i certificati NFT dei Tornei TraderLoading
(Champion / Podio / Finisher). Il conio è riservato al ruolo `MINTER`, assegnato
al **signer della piattaforma**; il backend lo concia da
[`services/tornei/mint/onchain.ts`](../artifacts/api-server/src/services/tornei/mint/onchain.ts)
chiamando `safeMint(address to, string uri)`.

> ⚠️ Questo è un **progetto Foundry separato**, fuori dal monorepo pnpm (non viene
> toccato da `pnpm verify`). Va compilato/testato/deployato con
> [Foundry](https://book.getfoundry.sh/). **Non è stato compilato nell'ambiente di
> sviluppo del repo** (Foundry non disponibile lì): esegui `forge build`/`forge test`
> prima del deploy.

## Interfaccia (contratto ↔ API)

```solidity
function safeMint(address to, string uri) external returns (uint256 tokenId);
event   Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
```

Combacia 1:1 con l'ABI in `onchain.ts`. Il client estrae `tokenId` dall'evento
`Transfer`. Il `uri` è l'endpoint metadata pubblico
`/api/tornei/certificates/{id}/metadata` (già implementato nell'API).

## Setup

```bash
cd contracts
# installa Foundry: https://book.getfoundry.sh/getting-started/installation
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std
forge build
forge test -vvv
```

## Deploy su Base

1. Crea un `.env` (non committarlo — è in `.gitignore`):

   ```bash
   PRIVATE_KEY=0x...            # deployer (paga il gas)
   ADMIN_ADDRESS=0x...          # detentore DEFAULT_ADMIN_ROLE (gestisce i ruoli)
   MINTER_ADDRESS=0x...         # signer della piattaforma (= chiave usata dall'API)
   BASE_RPC_URL=https://mainnet.base.org
   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
   BASESCAN_API_KEY=...         # opzionale, per la verifica del sorgente
   ```

2. **Prima su testnet** (Base Sepolia, chain id 84532) — servono ETH di test:

   ```bash
   source .env
   forge script script/Deploy.s.sol:Deploy \
     --rpc-url base_sepolia --broadcast --verify
   ```

3. **Mainnet** (Base, chain id 8453):

   ```bash
   forge script script/Deploy.s.sol:Deploy \
     --rpc-url base --broadcast --verify
   ```

Annota l'indirizzo del contratto stampato a fine deploy.

## Wiring lato API

Imposta queste env del backend (vedi [`.env.railway.example`](../.env.railway.example)):

| Env | Valore |
|---|---|
| `TORNEI_MINT_CONTRACT` | indirizzo del contratto deployato |
| `TORNEI_MINT_SIGNER_KEY` | chiave privata del `MINTER_ADDRESS` (**segreto**) |
| `TORNEI_MINT_RPC_URL` | RPC Base (es. Alchemy/Infura o `https://mainnet.base.org`) |
| `TORNEI_MINT_CHAIN_ID` | `8453` (Base mainnet) · `84532` (Base Sepolia) |

Con tutte e tre impostate, `getMintProvider()` attiva il conio reale; il signer
deve avere il `MINTER_ROLE` e abbastanza ETH per il gas. Senza, i certificati
restano `claimable` in DB (degradazione elegante).

## Note

- Il ruolo minter è gestibile dall'admin (`grantRole`/`revokeRole(MINTER_ROLE, …)`),
  così puoi ruotare il signer senza ridistribuire il contratto.
- I certificati sono **trasferibili** (ERC-721 standard). Se preferisci versioni
  *soulbound* (non trasferibili, legate al trader), si può aggiungere un override
  di `_update` che blocca i trasferimenti tra indirizzi non-zero — fuori scope per ora
  (vedi spec §13, niente marketplace/trasferimento).
