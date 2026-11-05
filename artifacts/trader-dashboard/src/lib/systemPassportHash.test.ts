import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSystemPassportExportDocument,
  computeSystemPassportHash,
  decodeSystemPassportShareToken,
  encodeSystemPassportShareToken,
  formatPassportSealCode,
  generateDeterministicQrMatrix,
  verifySystemPassportDocument,
  type SystemPassportPayload,
} from "./systemPassportHash";

const basePayload: SystemPassportPayload = {
  name: "Protocollo Londra Istituzionale",
  versionNumber: 1,
  phase: "define",
  markets: "EUR/USD, XAU/USD",
  windows: "Londra 08:00-11:00 UTC",
  setup: "Sweep Liquidità + BOS + FVG (M15/M5)",
  entry: "Ritracciamento al 50% FVG / Order Block",
  exit: "Parziale 50% a 2R + Stop a Breakeven",
  invalidation: "Chiusura M15 oltre l'estremo dello sweep",
  waitConditions: "15 min pre/post Red News (CPI, NFP, FOMC)",
  currency: "EUR",
  riskPerTrade: 50,
  maxDailyLoss: 100,
  maxDailyTrades: 2,
  checklistCount: 4,
};

// 1. Deterministic 64-hex hash verification
const hash1 = computeSystemPassportHash(basePayload);
const hash2 = computeSystemPassportHash({ ...basePayload });
assert.equal(hash1, hash2, "computeSystemPassportHash must be deterministic");
assert.equal(hash1.length, 64, "Hash must be 64 hex characters");
assert.match(hash1, /^[0-9A-F]{64}$/, "Hash must be uppercase hexadecimal");

// 2. Tamper detection across constitutional fields
const tamperedRiskHash = computeSystemPassportHash({
  ...basePayload,
  riskPerTrade: 100,
});
assert.notEqual(
  hash1,
  tamperedRiskHash,
  "Changing riskPerTrade must alter the cryptographic passport hash",
);

const tamperedMarketsHash = computeSystemPassportHash({
  ...basePayload,
  markets: "NAS100, BTC/USD",
});
assert.notEqual(
  hash1,
  tamperedMarketsHash,
  "Changing markets must alter the cryptographic passport hash",
);

const tamperedChecklistHash = computeSystemPassportHash({
  ...basePayload,
  checklistCount: 5,
});
assert.notEqual(
  hash1,
  tamperedChecklistHash,
  "Changing checklistCount must alter the cryptographic passport hash",
);

// 3. Seal code formatting
const sealCode = formatPassportSealCode(hash1);
assert.match(
  sealCode,
  /^AUREUS-SYS-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/,
  "Seal code must follow AUREUS-SYS-XXXX-XXXX-XXXX format",
);
assert.equal(
  sealCode,
  `AUREUS-SYS-${hash1.slice(0, 4)}-${hash1.slice(4, 8)}-${hash1.slice(8, 12)}`,
);

// 4. 21x21 QR Matrix and Finder Patterns verification
const qrMatrix = generateDeterministicQrMatrix(hash1, 21);
assert.equal(qrMatrix.length, 21, "QR matrix must have 21 rows");
for (const row of qrMatrix) {
  assert.equal(row.length, 21, "Each QR matrix row must have 21 columns");
}

const verifyFinderPattern = (rowOffset: number, colOffset: number) => {
  // Corner border cells must be true
  assert.equal(qrMatrix[rowOffset][colOffset], true, "Finder outer top-left must be true");
  assert.equal(qrMatrix[rowOffset][colOffset + 6], true, "Finder outer top-right must be true");
  assert.equal(qrMatrix[rowOffset + 6][colOffset], true, "Finder outer bottom-left must be true");
  assert.equal(qrMatrix[rowOffset + 6][colOffset + 6], true, "Finder outer bottom-right must be true");
  // Inner ring (rowOffset + 1, colOffset + 1..5) must be false
  assert.equal(qrMatrix[rowOffset + 1][colOffset + 1], false, "Finder inner separator must be false");
  // Center 3x3 core must be true
  assert.equal(qrMatrix[rowOffset + 3][colOffset + 3], true, "Finder 3x3 center core must be true");
};

verifyFinderPattern(0, 0);
verifyFinderPattern(0, 14);
verifyFinderPattern(14, 0);

// 4b. Signed JSON export and cryptographic verification (authentic vs tampered)
const exportedDoc = buildSystemPassportExportDocument(
  basePayload,
  ["Liquidità spazzata", "BOS M15", "Rischio 50 EUR", "Zero Red News"],
  "2026-11-05T00:00:00.000Z",
);
const authenticVerify = verifySystemPassportDocument(JSON.stringify(exportedDoc));
assert.equal(authenticVerify.valid, true, "Exported JSON document must verify as authentic");
assert.equal(authenticVerify.computedHash, hash1);
assert.equal(authenticVerify.computedSeal, sealCode);
assert.equal(authenticVerify.checklistItems?.length, 4);

const tamperedJsonDoc = {
  ...exportedDoc,
  system: {
    ...exportedDoc.system,
    riskGovernance: {
      ...exportedDoc.system.riskGovernance,
      riskPerTrade: 500, // tampered risk without updating seal/hash
    },
  },
};
const tamperedVerify = verifySystemPassportDocument(JSON.stringify(tamperedJsonDoc));
assert.equal(tamperedVerify.valid, false, "Tampered riskPerTrade must fail cryptographic verification");
assert.equal(tamperedVerify.reason, "hash_mismatch");

const invalidJsonVerify = verifySystemPassportDocument("{not-valid-json");
assert.equal(invalidJsonVerify.valid, false);
assert.equal(invalidJsonVerify.reason, "invalid_json");

// 4c. Signed Deep-Link Token (AUREUS1.<base64url> and ?passport= URL) roundtrip
const shareToken = encodeSystemPassportShareToken(
  basePayload,
  ["Liquidità spazzata", "BOS M15", "Rischio 50 EUR", "Zero Red News"],
  "2026-11-05T00:00:00.000Z",
);
assert.match(shareToken, /^AUREUS1\.[A-Za-z0-9_-]+$/);
const decodedFromToken = decodeSystemPassportShareToken(shareToken);
assert.equal(decodedFromToken.valid, true);
assert.equal(decodedFromToken.computedSeal, sealCode);

const decodedFromFullUrl = verifySystemPassportDocument(
  `https://aureus-os.app/method?passport=${encodeURIComponent(shareToken)}`,
);
assert.equal(decodedFromFullUrl.valid, true);
assert.equal(decodedFromFullUrl.payload?.name, basePayload.name);
assert.equal(decodedFromFullUrl.checklistItems?.length, 4);

// 5. Static integration checks in Method.tsx, DailyOrderMethodConsole.tsx & SystemPassportCard.tsx
const cardSource = readFileSync(
  new URL("../components/process/SystemPassportCard.tsx", import.meta.url),
  "utf8",
);
assert.match(cardSource, /Passaporto Crittografico del Sistema/);
assert.match(cardSource, /Copia Sigillo Crittografico/);
assert.match(cardSource, /Esporta JSON Costituzione/);
assert.match(cardSource, /whitespace-nowrap/);
assert.match(cardSource, /font-mono/);

const methodSource = readFileSync(new URL("../pages/Method.tsx", import.meta.url), "utf8");
assert.match(methodSource, /<SystemPassportCard/);

const consoleSource = readFileSync(
  new URL("../components/daily-order/DailyOrderMethodConsole.tsx", import.meta.url),
  "utf8",
);
assert.match(consoleSource, /<SystemPassportCard/);

console.log("✅ systemPassportHash.test.ts passed all assertions.");
