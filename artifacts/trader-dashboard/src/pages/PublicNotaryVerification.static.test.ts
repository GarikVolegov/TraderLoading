import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { verifyCryptographicHash } from "./PublicNotaryVerification.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pageFile = path.join(__dirname, "PublicNotaryVerification.tsx");
const appFile = path.join(__dirname, "../App.tsx");

test("PublicNotaryVerification: source file exists", () => {
  assert.ok(existsSync(pageFile), "PublicNotaryVerification.tsx must exist");
});

test("PublicNotaryVerification: verifyCryptographicHash validates standard 64-hex SHA-256 hash", () => {
  const validSha256 =
    "0x811C9DC527D4EB2FDEADBEEF41C6CE57811C9DC527D4EB2FDEADBEEF41C6CE57";
  const result = verifyCryptographicHash(validSha256);

  assert.equal(result.isValid, true);
  assert.equal(result.scheme, "SHA256_NOTARY");
  assert.equal(result.normalizedHash, validSha256);
  assert.ok(result.algorithm.includes("SHA-256"));
  assert.ok(result.securityLevel.includes("256-bit"));
  assert.ok(result.description.includes("Libro della Verità"));
});

test("PublicNotaryVerification: verifyCryptographicHash validates compact honor seal hash", () => {
  const compactHash = "0x811c9dc527d4eb2f";
  const result = verifyCryptographicHash(compactHash);

  assert.equal(result.isValid, true);
  assert.equal(result.scheme, "HONOR_SEAL");
  assert.equal(result.normalizedHash, "0x811C9DC527D4EB2F");
  assert.ok(result.securityLevel.includes("Compact"));
});

test("PublicNotaryVerification: verifyCryptographicHash rejects corrupt or invalid hashes", () => {
  // Invalid characters (not hex)
  const invalidChars = "0xNOT_A_VALID_HEX_STRING_123456";
  const res1 = verifyCryptographicHash(invalidChars);
  assert.equal(res1.isValid, false);
  assert.equal(res1.scheme, "INVALID");

  // Too short
  const tooShort = "0x123";
  const res2 = verifyCryptographicHash(tooShort);
  assert.equal(res2.isValid, false);
  assert.equal(res2.scheme, "INVALID");

  // Empty string
  const empty = "";
  const res3 = verifyCryptographicHash(empty);
  assert.equal(res3.isValid, false);
  assert.equal(res3.scheme, "INVALID");
});

test("PublicNotaryVerification: static content respects AUREUS design rules", () => {
  const source = readFileSync(pageFile, "utf8");

  // Ethos & Lore
  assert.ok(source.includes("AUREUS PROTOCOL"), "Must feature official brand name");
  assert.ok(source.includes("PORTALE DI VERIFICA NOTARILE"), "Must feature solemn header");
  assert.ok(source.includes("Libro della Verità"), "Must reference the Book of Truth");
  assert.ok(source.includes("Non Ducor, Duco"), "Must feature official Latin motto");

  // Palette & Monospace
  assert.ok(source.includes("#07080b"), "Must use Obsidian Sovrana background");
  assert.ok(source.includes("#C5A059"), "Must use Imperial Gold");
  assert.ok(source.includes("font-mono"), "Must render hashes and telemetries in monospace");

  // No gambling / retail gaming terms
  assert.ok(!source.includes("gambling"), "No gambling terms allowed");
  assert.ok(!source.includes("scommessa"), "No betting terms allowed");
  assert.ok(!source.includes("punti XP"), "No XP arcade terms allowed");
});

test("PublicNotaryVerification: route wiring is configured in App.tsx", () => {
  const appContent = readFileSync(appFile, "utf8");
  assert.ok(
    appContent.includes('const PublicNotaryVerification = lazy(() => import("./pages/PublicNotaryVerification"));'),
    "App.tsx must lazy-load PublicNotaryVerification"
  );
  assert.ok(
    appContent.includes('<Route path="/verifica/*?">'),
    "App.tsx must define /verifica route"
  );
  assert.ok(
    appContent.includes('<Route path="/verify/*?">'),
    "App.tsx must define /verify route"
  );
});
