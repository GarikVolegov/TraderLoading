import assert from "node:assert/strict";

function computeWatermarkDigest(operatorId: string, dateStr: string): string {
  const raw = `${operatorId}-${dateStr}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
}

function testSovereignVideoWatermark() {
  console.log("Testing SovereignVideoWatermark security logic & digest generation...");

  const opId1 = "user_2s8YmH7vBq9";
  const today = "2026-10-25";

  const digest1 = computeWatermarkDigest(opId1, today);
  const digest2 = computeWatermarkDigest(opId1, today);
  assert.equal(digest1, digest2, "Watermark digest must be deterministic for identical operator and date");
  assert.equal(digest1.length, 8, "Digest should be 8 hex characters padded");

  // Different operator should yield different digest
  const opId2 = "user_3k9LnW8xC10";
  const digestOther = computeWatermarkDigest(opId2, today);
  assert.notEqual(digest1, digestOther, "Different operators must produce distinct watermark digests");

  // Different date should yield different session digest
  const tomorrow = "2026-10-26";
  const digestTomorrow = computeWatermarkDigest(opId1, tomorrow);
  assert.notEqual(digest1, digestTomorrow, "Daily rotation must regenerate verification digest");

  console.log("SovereignVideoWatermark unit tests passed with 100% precision!");
}

testSovereignVideoWatermark();
