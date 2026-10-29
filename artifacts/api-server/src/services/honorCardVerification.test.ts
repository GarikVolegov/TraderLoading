import test from "node:test";
import assert from "node:assert/strict";
import {
  computeHonorHash,
  honorSealRegistry,
  type HonorClaimsPayload,
} from "./honorCardVerification.js";

test("honorCardVerification: computeHonorHash produces deterministic 64-bit hex signature", () => {
  const claims: HonorClaimsPayload = {
    operatorName: "Iniziato di Limen",
    winRate: 75.0,
    drawdown: 3.2,
    timestamp: "2026-10-25 20:00",
    totalTrades: 24,
  };

  const hash1 = computeHonorHash(claims);
  const hash2 = computeHonorHash(claims);

  assert.equal(hash1, hash2);
  assert.match(hash1, /^0x[0-9A-F]{16}$/);
});

test("honorCardVerification: computeHonorHash detects metric tampering", () => {
  const authenticClaims: HonorClaimsPayload = {
    operatorName: "Guerriero Aureus",
    winRate: 68.5,
    drawdown: 2.1,
    timestamp: "2026-10-25 18:30",
    totalTrades: 15,
  };

  const authenticHash = computeHonorHash(authenticClaims);

  // Altered winRate
  const forgedClaims: HonorClaimsPayload = {
    ...authenticClaims,
    winRate: 98.5,
  };
  const forgedHash = computeHonorHash(forgedClaims);

  assert.notEqual(authenticHash, forgedHash);

  // Altered operatorName
  const spoofedNameClaims: HonorClaimsPayload = {
    ...authenticClaims,
    operatorName: "Hacker",
  };
  assert.notEqual(authenticHash, computeHonorHash(spoofedNameClaims));
});

test("honorCardVerification: honorSealRegistry registers and retrieves seals by hash", () => {
  honorSealRegistry.clearForTesting();

  const sealData: HonorClaimsPayload = {
    operatorName: "Custode del Varco",
    operatorGrade: "GRADO II · CUSTODE",
    tradeType: "LIVE",
    symbol: "XAU/USD",
    title: "ESECUZIONE CONFORME",
    totalProfitFormatted: "+€850.00",
    winRate: 80.0,
    integrityScore: 95,
    totalTrades: 10,
    drawdown: 1.5,
    timestamp: "2026-10-25 19:15",
  };

  const registered = honorSealRegistry.registerSeal(sealData);

  assert.ok(registered.hash.startsWith("0x"));
  assert.equal(registered.operatorName, "Custode del Varco");

  // Retrieve by exact hash
  const retrieved = honorSealRegistry.getSeal(registered.hash);
  assert.ok(retrieved);
  assert.equal(retrieved?.totalProfitFormatted, "+€850.00");

  // Retrieve by lowercase hash
  const retrievedLower = honorSealRegistry.getSeal(registered.hash.toLowerCase());
  assert.ok(retrievedLower);
  assert.equal(retrievedLower?.hash, registered.hash);

  // Non-existent hash
  assert.equal(honorSealRegistry.getSeal("0x0000000000000000"), null);
});

test("honorCardVerification: honorSealRegistry verifies mathematical claims accurately", () => {
  const claims: HonorClaimsPayload = {
    operatorName: "Architetto Aureus",
    winRate: 85.0,
    drawdown: 0.9,
    timestamp: "2026-10-25 21:00",
    totalTrades: 30,
  };

  const hash = computeHonorHash(claims);

  // 1. Valid claims
  const validCheck = honorSealRegistry.verifyClaims(hash, claims);
  assert.equal(validCheck.isValid, true);
  assert.equal(validCheck.expectedHash, hash);

  // 2. Tampered claims
  const tamperedCheck = honorSealRegistry.verifyClaims(hash, {
    ...claims,
    winRate: 99.0,
  });
  assert.equal(tamperedCheck.isValid, false);
  assert.notEqual(tamperedCheck.expectedHash, hash);
});
