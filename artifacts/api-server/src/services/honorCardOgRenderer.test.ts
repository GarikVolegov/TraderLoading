import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHonorCardSvg, renderHonorCardHtml } from "./honorCardOgRenderer.js";
import { type RegisteredHonorSeal } from "./honorCardVerification.js";

const mockSeal: RegisteredHonorSeal = {
  hash: "0x9F4C2A1E8B0D7C3F",
  operatorName: "Marcus <Aurelius> & Co",
  operatorGrade: "L'Architetto",
  tradeType: "LIVE",
  symbol: "EURUSD",
  title: "Prova del Fuoco",
  totalProfitFormatted: "+€1.450,00",
  winRate: 78,
  integrityScore: 98,
  totalTrades: 12,
  drawdown: 1.8,
  timestamp: "2026-10-25T20:00:00Z",
  registeredAt: Date.now(),
};

test("renderHonorCardSvg: generates valid 1200x630 SVG with XML-escaped fields", () => {
  const svg = renderHonorCardSvg(mockSeal);

  assert.ok(svg.startsWith("<svg"), "Must start with <svg tag");
  assert.ok(svg.endsWith("</svg>"), "Must end with </svg> tag");
  assert.ok(svg.includes('width="1200"'), "Must be 1200px wide");
  assert.ok(svg.includes('height="630"'), "Must be 630px high");

  // Escaping verification
  assert.ok(svg.includes("Marcus &lt;Aurelius&gt; &amp; Co"), "Must escape XML characters in name");
  assert.ok(svg.includes("L&apos;Architetto"), "Must escape apostrophe in grade");
  assert.ok(svg.includes("+€1.450,00"), "Must include formatted P&L");
  assert.ok(svg.includes("78%"), "Must include win rate");
  assert.ok(svg.includes("98%"), "Must include integrity score");
  assert.ok(svg.includes("0x9F4C2A1E8B0D7C3F"), "Must include verification hash");
  assert.ok(svg.includes("CRITTOGRAFIA CONFORME"), "Must display green verification badge");
});

test("renderHonorCardSvg: handles null seal gracefully with fallback hash", () => {
  const svg = renderHonorCardSvg(null, "0xDEADBEEFCAFE1234");
  assert.ok(svg.includes("0xDEADBEEFCAFE1234"), "Must contain fallback hash");
  assert.ok(svg.includes("Operatore dell&apos;Ordine"), "Must contain default operator title");
  assert.ok(svg.includes("SIGILLO IN VERIFICA"), "Must display in-verification status");
});

test("renderHonorCardHtml: produces complete HTML with OpenGraph and Twitter cards", () => {
  const html = renderHonorCardHtml(mockSeal, "https://aureus.trade", mockSeal.hash);

  assert.ok(html.includes("<!DOCTYPE html>"), "Must be a complete HTML5 document");
  assert.ok(html.includes('<meta property="og:type" content="website" />'), "Must contain og:type");
  assert.ok(html.includes('<meta property="og:image" content="https://aureus.trade/api/public/og-honor/0x9F4C2A1E8B0D7C3F.svg" />'), "Must point og:image to SVG endpoint");
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image" />'), "Must use summary_large_image for Twitter");
  assert.ok(html.includes("0x9F4C2A1E8B0D7C3F"), "Must display hash in card");
  assert.ok(html.includes("VERIFICATO MATEMATICAMENTE"), "Must show verified status");
});
