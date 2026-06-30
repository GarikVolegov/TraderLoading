// Conio reale on-chain su Base (L2 EVM) via ethers v6. Richiede un contratto
// ERC-721 con ruolo minter assegnato al signer della piattaforma. Il tokenURI
// (metadata + immagine) è prodotto a monte.
//
// Provider/contract sono costruiti in modo lazy al primo `mint()`: la costruzione
// dell'oggetto non apre connessioni né effettua probe di rete (nessun lavoro al
// boot del server, e selezionarlo nei test è inerte).

import { JsonRpcProvider, Wallet, Contract, Network, type Log } from "ethers";
import type { MintProvider, MintRequest, MintResult } from "./provider.js";

const ABI = [
  "function safeMint(address to, string uri) returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

type OnchainConfig = { rpcUrl: string; contractAddress: string; signerKey: string; chainId: number };

export class OnchainMintProvider implements MintProvider {
  readonly kind = "onchain" as const;
  private readonly cfg: OnchainConfig;
  private contract: Contract | null = null;

  constructor(cfg: OnchainConfig) {
    this.cfg = cfg;
  }

  private getContract(): Contract {
    if (this.contract) return this.contract;
    const network = Network.from(this.cfg.chainId);
    const provider = new JsonRpcProvider(this.cfg.rpcUrl, network, { staticNetwork: network });
    const wallet = new Wallet(this.cfg.signerKey, provider);
    this.contract = new Contract(this.cfg.contractAddress, ABI, wallet);
    return this.contract;
  }

  async mint(req: MintRequest): Promise<MintResult> {
    const contract = this.getContract();
    const tx = await contract.safeMint(req.toAddress, req.tokenUri);
    const receipt = await tx.wait();

    // Estrae il tokenId dall'evento Transfer.
    let tokenId = "0";
    for (const log of (receipt?.logs ?? []) as Log[]) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === "Transfer") {
          tokenId = parsed.args.tokenId.toString();
          break;
        }
      } catch {
        // log non appartenente al nostro contratto/evento
      }
    }

    return {
      tokenId,
      txHash: tx.hash,
      contractAddress: this.cfg.contractAddress,
      chain: `eip155:${this.cfg.chainId}`,
    };
  }
}
