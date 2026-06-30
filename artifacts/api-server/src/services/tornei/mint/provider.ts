// Astrazione del conio dei certificati NFT. Il conio reale on-chain è attivo
// solo quando le env TORNEI_MINT_* sono configurate; altrimenti la factory
// ritorna null e i certificati restano "claimable" (degradazione elegante, come
// LLM/Stripe non configurati).

import { FakeMintProvider } from "./fake.js";
import { OnchainMintProvider } from "./onchain.js";

export type MintRequest = {
  certificateId: number;
  tier: string;
  seasonLabel: string;
  toAddress: string;
  tokenUri: string;
};

export type MintResult = {
  tokenId: string;
  txHash: string;
  contractAddress: string;
  chain: string;
};

export interface MintProvider {
  readonly kind: "onchain" | "fake";
  mint(req: MintRequest): Promise<MintResult>;
}

export { FakeMintProvider } from "./fake.js";

export function getMintProvider(env: NodeJS.ProcessEnv = process.env): MintProvider | null {
  if (env.NODE_ENV === "test" && env.TORNEI_MINT_FAKE === "1") return new FakeMintProvider();

  const rpcUrl = env.TORNEI_MINT_RPC_URL;
  const contractAddress = env.TORNEI_MINT_CONTRACT;
  const signerKey = env.TORNEI_MINT_SIGNER_KEY;
  if (rpcUrl && contractAddress && signerKey) {
    return new OnchainMintProvider({
      rpcUrl,
      contractAddress,
      signerKey,
      chainId: Number(env.TORNEI_MINT_CHAIN_ID ?? "8453"), // Base mainnet
    });
  }
  return null;
}
