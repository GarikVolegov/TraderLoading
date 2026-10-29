import assert from "node:assert/strict";
import {
  computeHonorHash,
  canShareHonorCard,
  renderHonorCardToCanvas,
  generateHonorCardBlob,
  type HonorCardData,
} from "./honorCardGenerator";

// 1. Test hash computation
const sampleData: HonorCardData = {
  operatorName: "Marcus_Aurelius",
  asset: "XAUUSD",
  winRate: 80,
  winTrades: 4,
  totalTrades: 5,
  drawdown: 1.8,
  maxAllowedDrawdown: 10,
  totalProfitFormatted: "+$2,450.00",
  integrityScore: 100,
  timestamp: "2026-10-25 17:00",
};

const hash1 = computeHonorHash(sampleData);
const hash2 = computeHonorHash(sampleData);
assert.equal(hash1, hash2, "Honor card hash must be deterministic");
assert.ok(hash1.startsWith("0x"), "Honor card hash must start with 0x prefix");
assert.equal(hash1.length, 18, "Honor card hash must be 18 chars (0x + 16 hex chars)");

// Verify hash sensitivity to changes
const modifiedData: HonorCardData = { ...sampleData, winRate: 85 };
const hashModified = computeHonorHash(modifiedData);
assert.notEqual(hash1, hashModified, "Altered telemetry must yield a different verification hash");

// 2. Test canShareHonorCard in Node environment
const canShare = canShareHonorCard();
assert.equal(typeof canShare, "boolean", "canShareHonorCard must return a boolean");

// 3. Test Canvas rendering in Mock DOM environment
const mockContext = {
  scale: () => {},
  createRadialGradient: () => ({
    addColorStop: () => {},
  }),
  createLinearGradient: () => ({
    addColorStop: () => {},
  }),
  fillRect: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  beginPath: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  quadraticCurveTo: () => {},
  fillText: () => {},
  measureText: () => ({ width: 100 }),
  strokeStyle: "",
  fillStyle: "",
  lineWidth: 1,
  font: "",
  textAlign: "",
  textBaseline: "",
  letterSpacing: "",
  shadowColor: "",
  shadowBlur: 0,
};

const mockCanvas = {
  width: 0,
  height: 0,
  style: {},
  getContext: (type: string) => (type === "2d" ? mockContext : null),
  toBlob: (cb: (b: Blob | null) => void) => {
    cb(new Blob(["test-blob-bytes"], { type: "image/png" }));
  },
  toDataURL: () => "data:image/png;base64,mockHonorCardBase64",
};

// Install mock global document for rendering test
const originalDocument = globalThis.document;
(globalThis as unknown as { document: unknown }).document = {
  createElement: (tag: string) => {
    if (tag === "canvas") return mockCanvas;
    return {};
  },
};

try {
  const canvas = renderHonorCardToCanvas(sampleData);
  assert.ok(canvas, "renderHonorCardToCanvas must return a canvas element");
  assert.equal(canvas.width, 2400, "Retina canvas width must be 2400px (1200 * 2)");
  assert.equal(canvas.height, 1260, "Retina canvas height must be 1260px (630 * 2)");

  // Test Blob generation
  const blobPromise = generateHonorCardBlob(sampleData);
  assert.ok(blobPromise instanceof Promise, "generateHonorCardBlob must return a Promise");
  const blob = await blobPromise;
  assert.ok(blob, "Generated Blob must be defined");
  assert.equal(blob.type, "image/png", "Blob MIME type must be image/png");
} finally {
  (globalThis as unknown as { document: unknown }).document = originalDocument;
}

console.log("Honor Card Generator unit tests passed with 100% precision!");
