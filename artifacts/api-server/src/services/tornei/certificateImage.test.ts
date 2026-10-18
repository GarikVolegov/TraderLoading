import assert from "node:assert/strict";
import { certificateIdFromParam, renderCertificateImage } from "./certificateImage.js";

assert.equal(certificateIdFromParam("1"), 1);
assert.equal(certificateIdFromParam("2147483647"), 2147483647);
for (const invalid of [undefined, ["1"], 1, "0", "-1", "1.5", "1e2", "01", " 1", "1tail", "2147483648", "999999999999999999999"]) {
  assert.equal(certificateIdFromParam(invalid), null);
}
const image = renderCertificateImage({ tier: '<script onload="x">', seasonLabel: "A & B\u0000", edition: "<image href='https://example.com'/>", rarity: "Raro" });
assert.ok(image.includes("&lt;script onload=&quot;x&quot;&gt;"));
assert.ok(image.includes("A &amp; B"));
assert.ok(image.includes("&apos;https://example.com&apos;"));
assert.doesNotMatch(image, /<script|<image|<foreignObject/);
assert.equal(image.includes("\u0000"), false);
const unicode = renderCertificateImage({ tier: "🏆", seasonLabel: "\ud800\ufffe", edition: "E", rarity: "R" });
assert.ok(unicode.includes("🏆"));
assert.equal(unicode.includes("\ud800"), false);
assert.equal(unicode.includes("\ufffe"), false);
assert.ok(renderCertificateImage({ tier: "x".repeat(10000), seasonLabel: "S", edition: "E", rarity: "R" }).length < 2500);
console.log("certificateImage.test.ts: all assertions passed");
