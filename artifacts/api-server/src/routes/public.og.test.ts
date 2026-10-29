import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import publicRouter from "./public.js";
import { honorSealRegistry } from "../services/honorCardVerification.js";

// Ensure a test seal is in the registry
const testSeal = honorSealRegistry.registerSeal({
  operatorName: "Marcus Aurelius Test",
  operatorGrade: "L'Architetto",
  title: "Prova del Fuoco Test",
  symbol: "EURUSD",
  totalProfitFormatted: "+€2.500,00",
  winRate: 85,
  integrityScore: 99,
  totalTrades: 15,
  drawdown: 1.2,
  timestamp: "2026-10-25T20:00:00Z",
});

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api", publicRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/api`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("public routes: GET /public/og-honor/:hash.svg serves vector OpenGraph card", async () => {
  const server = await startTestServer();
  try {
    const res = await fetch(`${server.baseUrl}/public/og-honor/${testSeal.hash}.svg`);
    assert.equal(res.status, 200);
    const contentType = res.headers.get("content-type") || "";
    assert.ok(contentType.includes("image/svg+xml"), `Content-Type must be image/svg+xml, got ${contentType}`);
    const svgText = await res.text();
    assert.ok(svgText.includes("<svg"), "Must return valid SVG");
    assert.ok(svgText.includes("AUREUS PROTOCOL"), "Must contain AUREUS PROTOCOL wordmark");
    assert.ok(svgText.includes("Marcus Aurelius Test"), "Must contain operator name");
  } finally {
    await server.close();
  }
});

test("public routes: GET /public/verify-honor/:hash honors JSON content negotiation", async () => {
  const server = await startTestServer();
  try {
    const res = await fetch(`${server.baseUrl}/public/verify-honor/${testSeal.hash}`, {
      headers: { Accept: "application/json" },
    });
    assert.equal(res.status, 200);
    const contentType = res.headers.get("content-type") || "";
    assert.ok(contentType.includes("application/json"), `Content-Type must be json, got ${contentType}`);
    const body = (await res.json()) as { isValid: boolean; status: string; verificationHash: string };
    assert.equal(body.isValid, true);
    assert.equal(body.status, "VERIFIED");
  } finally {
    await server.close();
  }
});

test("public routes: GET /public/verify-honor/:hash serves rich HTML OpenGraph page for browsers and social crawlers", async () => {
  const server = await startTestServer();
  try {
    // 1. Browser request with Accept: text/html
    const browserRes = await fetch(`${server.baseUrl}/public/verify-honor/${testSeal.hash}`, {
      headers: { Accept: "text/html,application/xhtml+xml,application/xml" },
    });
    assert.equal(browserRes.status, 200);
    const browserContentType = browserRes.headers.get("content-type") || "";
    assert.ok(browserContentType.includes("text/html"), "Browser request must receive text/html");
    const browserHtml = await browserRes.text();
    assert.ok(browserHtml.includes("<meta property=\"og:image\""), "HTML must contain og:image tag");
    assert.ok(browserHtml.includes("<meta name=\"twitter:card\""), "HTML must contain twitter:card tag");
    assert.ok(browserHtml.includes("Marcus Aurelius Test"), "HTML must contain operator name");

    // 2. Social crawler with TelegramBot User-Agent
    const botRes = await fetch(`${server.baseUrl}/public/verify-honor/${testSeal.hash}`, {
      headers: { "User-Agent": "TelegramBot (like TwitterBot)" },
    });
    assert.equal(botRes.status, 200);
    const botContentType = botRes.headers.get("content-type") || "";
    assert.ok(botContentType.includes("text/html"), "Social crawler must receive text/html");
  } finally {
    await server.close();
  }
});
