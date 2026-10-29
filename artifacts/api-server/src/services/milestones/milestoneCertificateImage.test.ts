import assert from "node:assert/strict";
import { certificateIdFromParam, renderMilestoneCertificateSvg } from "./milestoneCertificateImage.js";

// ID parsing checks
assert.equal(certificateIdFromParam("1"), 1);
assert.equal(certificateIdFromParam("42"), 42);
assert.equal(certificateIdFromParam("0"), null);
assert.equal(certificateIdFromParam("-5"), null);
assert.equal(certificateIdFromParam("abc"), null);
assert.equal(certificateIdFromParam("1.5"), null);
assert.equal(certificateIdFromParam(null), null);
assert.equal(certificateIdFromParam(undefined), null);

// SVG generation with XSS injection check
const svg = renderMilestoneCertificateSvg({
  id: 1,
  userId: "user-123",
  userName: '<script>alert("xss")</script> & Trader',
  level: 1,
  levelName: "Novizio Consapevole",
  milestoneTitle: "Il Varco",
  awardedAt: new Date("2026-06-13T12:00:00Z"),
});

assert.ok(svg.includes("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; Trader"));
assert.ok(!svg.includes("<script>"));
assert.ok(svg.includes("GRADO I"));
assert.ok(svg.includes("AUREUS PROTOCOL"));

// Grade 5 check
const svgGrade5 = renderMilestoneCertificateSvg({
  id: 5,
  userId: "user-555",
  userName: "Master Founder",
  level: 5,
  levelName: "Rango Supremo Personalizzato",
});
assert.ok(svgGrade5.includes("GRADO V"));
assert.ok(svgGrade5.includes("RANGO SUPREMO PERSONALIZZATO"));
assert.ok(svgGrade5.includes("GRADO V · MASTER FOUNDER"));

console.log("milestoneCertificateImage.test.ts: all assertions passed");
