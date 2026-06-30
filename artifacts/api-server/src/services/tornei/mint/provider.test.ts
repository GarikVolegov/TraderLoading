import assert from "node:assert/strict";
import { getMintProvider, FakeMintProvider } from "./provider.js";

// ── nessun provider quando le env on-chain non ci sono ───────────────────────
{
  assert.equal(getMintProvider({} as NodeJS.ProcessEnv), null);
}

// ── il fake produce un risultato deterministico ──────────────────────────────
{
  const p = new FakeMintProvider();
  assert.equal(p.kind, "fake");
  const res = await p.mint({
    certificateId: 1,
    tier: "champion",
    seasonLabel: "Q3 2025",
    toAddress: "0xabc",
    tokenUri: "ipfs://x",
  });
  assert.match(res.txHash, /^0x/);
  assert.equal(res.tokenId, "1");
}

// ── il provider on-chain è selezionato con le env presenti ───────────────────
{
  const env = {
    TORNEI_MINT_RPC_URL: "https://base.example",
    TORNEI_MINT_CONTRACT: "0xcontract",
    TORNEI_MINT_SIGNER_KEY: "0x" + "1".repeat(64),
  } as unknown as NodeJS.ProcessEnv;
  const p = getMintProvider(env);
  assert.equal(p?.kind, "onchain");
}

console.log("mint/provider.test.ts: all assertions passed");
