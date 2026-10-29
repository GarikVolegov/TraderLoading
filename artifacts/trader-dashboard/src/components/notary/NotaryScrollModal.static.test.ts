import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modalFile = path.join(__dirname, "NotaryScrollModal.tsx");

test("NotaryScrollModal: file exists and contains essential notarial triggers", () => {
  assert.ok(fs.existsSync(modalFile), "NotaryScrollModal.tsx must exist");
  const content = fs.readFileSync(modalFile, "utf8");

  assert.ok(content.includes("renderNotaryScroll"), "Must invoke renderNotaryScroll");
  assert.ok(content.includes("downloadNotaryScroll"), "Must support downloadNotaryScroll");
  assert.ok(content.includes("printNotaryScroll"), "Must support printNotaryScroll");
  assert.ok(content.includes("computeNotaryHash"), "Must support computeNotaryHash");
  assert.ok(content.includes("synestheticTrophy"), "Must play trophy fanfara on open");
  assert.ok(content.includes("synestheticCheck"), "Must play check bell on copy");
  assert.ok(content.includes("Impronta SHA-256"), "Must render SHA-256 fingerprint");
  assert.ok(content.includes("Pergamena Notarile Sovrana"), "Must render noble solemn title");
  assert.ok(content.includes("Cinema d'Onore (WebM)"), "Must provide Cinema d'Onore WebM button");
  assert.ok(content.includes("downloadNotaryCinematicVideo"), "Must trigger downloadNotaryCinematicVideo");
  assert.ok(content.includes("isCinematicVideoSupported"), "Must check isCinematicVideoSupported");
});
