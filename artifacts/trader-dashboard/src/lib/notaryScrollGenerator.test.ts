import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeNotaryHash,
  renderNotaryScroll,
  isCinematicVideoSupported,
  generateNotaryCinematicVideo,
  downloadNotaryCinematicVideo,
  type NotaryScrollData,
} from "./notaryScrollGenerator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceFile = path.join(__dirname, "notaryScrollGenerator.ts");

test("notaryScrollGenerator: source file exists", () => {
  assert.ok(fs.existsSync(sourceFile), "notaryScrollGenerator.ts must exist");
});

test("notaryScrollGenerator: computeNotaryHash produces deterministic 64-character hash", () => {
  const data: NotaryScrollData = {
    operatorName: "GARIKFX",
    gradeTitle: "Sovrano",
    gradeCode: "GRADO IV",
    integrityIndex: 100,
    consecutiveSessions: 42,
    violationsCount: 0,
    winRate: 78.5,
    profitFormatted: "+€14,850.00",
    issueDate: "2026-10-25 14:00:00 UTC",
  };

  const hash1 = computeNotaryHash(data);
  const hash2 = computeNotaryHash(data);

  assert.equal(hash1, hash2, "Hash must be strictly deterministic");
  assert.ok(hash1.startsWith("0x"), "Hash must begin with 0x hex prefix");
  // 0x + 64 hex characters = 66 characters
  assert.equal(hash1.length, 66, "Hash must be 66 characters total (0x + 64 hex digest)");

  // Modifying consecutiveSessions must change the hash
  const modifiedData: NotaryScrollData = { ...data, consecutiveSessions: 43 };
  const hashModified = computeNotaryHash(modifiedData);
  assert.notEqual(hash1, hashModified, "Different input must yield different hash");

  // Modifying operatorName must change the hash
  const modifiedOperator: NotaryScrollData = { ...data, operatorName: "MARCUS" };
  const hashOpModified = computeNotaryHash(modifiedOperator);
  assert.notEqual(hash1, hashOpModified, "Different operator must yield different hash");
});

test("notaryScrollGenerator: renderNotaryScroll executes safely with mock Canvas 2D context", () => {
  let fillRectCalls = 0;
  let strokeCalls = 0;
  let fillTextCalls = 0;
  let arcCalls = 0;

  const mockCtx = {
    scale: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    arc: () => {
      arcCalls++;
    },
    fillRect: () => {
      fillRectCalls++;
    },
    strokeRect: () => {},
    stroke: () => {
      strokeCalls++;
    },
    fill: () => {},
    fillText: () => {
      fillTextCalls++;
    },
    measureText: (text: string) => ({ width: text.length * 8 }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "center",
    letterSpacing: "0em",
  };

  const mockCanvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: (type: string) => (type === "2d" ? mockCtx : null),
  } as unknown as HTMLCanvasElement;

  const sampleData: NotaryScrollData = {
    operatorName: "AUREUS_ARCHITECT",
    gradeTitle: "Architetto",
    gradeCode: "GRADO V",
    integrityIndex: 98,
    consecutiveSessions: 120,
    violationsCount: 0,
    winRate: 82.4,
    totalTrades: 350,
    profitFormatted: "+€42,190.00",
    maxDrawdown: 3.2,
    pillars: {
      patience: 95,
      risk: 100,
      precision: 90,
      firmness: 98,
      integrity: 100,
    },
    issueDate: "2026-10-25 15:30:00 UTC",
  };

  assert.doesNotThrow(() => {
    renderNotaryScroll(mockCanvas, sampleData);
  }, "renderNotaryScroll must execute cleanly without error");

  assert.ok(fillRectCalls > 0, "Must fill background and ornaments");
  assert.ok(strokeCalls > 0, "Must draw guilloche frames and octagrams");
  assert.ok(fillTextCalls > 15, "Must render title, operator, telemetry, and Latin maxim");
  assert.ok(arcCalls > 0, "Must draw sacred concentric geometry");
});

test("notaryScrollGenerator: isCinematicVideoSupported is SSR-safe and returns boolean", () => {
  const supported = isCinematicVideoSupported();
  assert.equal(typeof supported, "boolean", "isCinematicVideoSupported must return boolean");
  // In Node.js environment without DOM Canvas captureStream, it should be false
  assert.equal(supported, false, "Must return false in Node.js test environment");
});

test("notaryScrollGenerator: generateNotaryCinematicVideo rejects gracefully when unsupported", async () => {
  const data: NotaryScrollData = {
    operatorName: "GARIKFX",
    gradeTitle: "Sovrano",
    gradeCode: "GRADO IV",
    integrityIndex: 100,
    consecutiveSessions: 42,
    violationsCount: 0,
  };

  await assert.rejects(
    async () => {
      await generateNotaryCinematicVideo(data);
    },
    (err: Error) => {
      assert.ok(
        err.message.includes("Cinema d'Onore non supportato"),
        "Must provide clear reason for unsupported video capture in headless/Node"
      );
      return true;
    }
  );
});

test("notaryScrollGenerator: downloadNotaryCinematicVideo is exported and callable", () => {
  assert.equal(typeof downloadNotaryCinematicVideo, "function", "Must export downloadNotaryCinematicVideo function");
});
