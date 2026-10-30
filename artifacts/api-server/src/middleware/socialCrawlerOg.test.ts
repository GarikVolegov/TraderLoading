import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import {
  socialCrawlerOgMiddleware,
  renderArenaSpectatorOgHtml,
  SOCIAL_CRAWLER_REGEX,
} from "./socialCrawlerOg.js";

describe("socialCrawlerOgMiddleware", () => {
  it("detects social crawlers and search engine bots", () => {
    assert.ok(SOCIAL_CRAWLER_REGEX.test("TelegramBot (like TwitterBot)"));
    assert.ok(SOCIAL_CRAWLER_REGEX.test("facebookexternalhit/1.1"));
    assert.ok(SOCIAL_CRAWLER_REGEX.test("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"));
    assert.ok(SOCIAL_CRAWLER_REGEX.test("WhatsApp/2.21.12.21"));
    assert.ok(SOCIAL_CRAWLER_REGEX.test("LinkedInBot/1.0"));
    assert.ok(!SOCIAL_CRAWLER_REGEX.test("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"));
  });

  it("renders Arena Spectator OpenGraph HTML with correct metadata and canonical URL", () => {
    const html = renderArenaSpectatorOgHtml("ARENA-8891", "https://aureus-os.app");
    assert.ok(html.includes("AUREUS PROTOCOL · Arena della Disciplina [ARENA-8891]"));
    assert.ok(html.includes('content="https://aureus-os.app/duello/ARENA-8891"'));
    assert.ok(html.includes('href="https://aureus-os.app/duello/ARENA-8891"'));
  });

  it("serves rich OpenGraph HTML for crawler requests on /verifica/:hash", async () => {
    let sentBody = "";
    let sentStatus = 200;
    const headers: Record<string, string> = {};

    const req = {
      method: "GET",
      path: "/verifica/NONEXISTENT_HASH",
      headers: {
        "user-agent": "TelegramBot (like TwitterBot)",
      },
      query: {},
    } as unknown as Request;

    const res = {
      setHeader(k: string, v: string) {
        headers[k] = v;
      },
      status(s: number) {
        sentStatus = s;
        return this;
      },
      send(body: string) {
        sentBody = body;
      },
    } as unknown as Response;

    let nextCalled = false;
    await socialCrawlerOgMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, "Must not call next() for crawler on /verifica");
    assert.equal(headers["Content-Type"], "text/html; charset=utf-8");
    assert.ok(sentBody.includes("AUREUS PROTOCOL"), "Must contain AUREUS brand");
    assert.ok(sentBody.includes("NONEXISTENT_HASH"), "Must contain requested hash");
  });

  it("serves rich OpenGraph HTML and SVG card for crawler requests on /duello/:roomId", async () => {
    let sentBody = "";
    const headers: Record<string, string> = {};

    const req = {
      method: "GET",
      path: "/duello/FORGIA-8891",
      headers: {
        "user-agent": "Twitterbot/1.0",
      },
      query: {},
    } as unknown as Request;

    const res = {
      setHeader(k: string, v: string) {
        headers[k] = v;
      },
      send(body: string) {
        sentBody = body;
      },
    } as unknown as Response;

    let nextCalled = false;
    await socialCrawlerOgMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, "Must not call next() for crawler on /duello");
    assert.equal(headers["Content-Type"], "text/html; charset=utf-8");
    assert.ok(sentBody.includes("FORGIA-8891"), "Must contain room code");
    assert.ok(sentBody.includes("/api/public/og-duello/FORGIA-8891.svg"), "Must link to vector duel SVG");
  });

  it("passes through to next() for ordinary non-crawler user browsers", async () => {
    const req = {
      method: "GET",
      path: "/verifica/SOME_HASH",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
      },
      query: {},
    } as unknown as Request;

    const res = {} as unknown as Response;

    let nextCalled = false;
    await socialCrawlerOgMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, "Must call next() for ordinary browser");
  });
});
