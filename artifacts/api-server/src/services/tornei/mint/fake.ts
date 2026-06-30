// Provider di conio in-memory deterministico per test e sviluppo locale (con
// TORNEI_MINT_FAKE=1). Non effettua chiamate di rete.

import type { MintProvider, MintRequest, MintResult } from "./provider.js";

export class FakeMintProvider implements MintProvider {
  readonly kind = "fake" as const;

  async mint(req: MintRequest): Promise<MintResult> {
    return {
      tokenId: String(req.certificateId),
      txHash: "0x" + req.certificateId.toString(16).padStart(64, "0"),
      contractAddress: "0xfake",
      chain: "fake",
    };
  }
}
