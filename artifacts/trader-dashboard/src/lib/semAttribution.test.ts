import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyTrafficSource,
  detectAiEngine,
  extractReferrerHost,
  SEM_ATTRIBUTION_TTL_MS,
} from "./semAttribution.ts";

describe("semAttribution (SEM & AI Search / GEO Attribution Engine)", () => {
  it("classifies AI Search traffic from ChatGPT, Perplexity, Claude, Gemini, Copilot, and Grok", () => {
    const chatgpt = classifyTrafficSource({
      search: "?utm_source=chatgpt.com",
      referrer: "https://chatgpt.com/",
      landingPath: "/it/forgia-del-passato",
      now: 1_700_000_000_000,
    });
    assert.equal(chatgpt.channel, "ai_search");
    assert.equal(chatgpt.aiEngine, "chatgpt");
    assert.equal(chatgpt.landingPath, "/it/forgia-del-passato");
    assert.equal(chatgpt.expiresAt, 1_700_000_000_000 + SEM_ATTRIBUTION_TTL_MS);

    const perplexity = classifyTrafficSource({
      search: "",
      referrer: "https://www.perplexity.ai/search/aureus-protocol",
    });
    assert.equal(perplexity.channel, "ai_search");
    assert.equal(perplexity.aiEngine, "perplexity");

    const claude = classifyTrafficSource({
      search: "",
      referrer: "https://claude.ai/chat/123",
    });
    assert.equal(claude.channel, "ai_search");
    assert.equal(claude.aiEngine, "claude");

    const gemini = classifyTrafficSource({
      search: "",
      referrer: "https://gemini.google.com/app",
    });
    assert.equal(gemini.channel, "ai_search");
    assert.equal(gemini.aiEngine, "gemini");

    const copilot = classifyTrafficSource({
      search: "",
      referrer: "https://copilot.microsoft.com/",
    });
    assert.equal(copilot.channel, "ai_search");
    assert.equal(copilot.aiEngine, "copilot");

    const grok = classifyTrafficSource({
      search: "",
      referrer: "https://grok.com/",
    });
    assert.equal(grok.channel, "ai_search");
    assert.equal(grok.aiEngine, "grok");
  });

  it("classifies Paid SEM traffic when click IDs (gclid, fbclid, msclkid) or paid mediums are present", () => {
    const googleAds = classifyTrafficSource({
      search: "?utm_source=google&utm_medium=cpc&utm_campaign=aureus_forgia_it&utm_term=simulatore+trading&gclid=EAIaIQobChMI_test",
      referrer: "https://www.google.com/",
    });
    assert.equal(googleAds.channel, "paid_sem");
    assert.equal(googleAds.gclid, "EAIaIQobChMI_test");
    assert.equal(googleAds.utmCampaign, "aureus_forgia_it");
    assert.equal(googleAds.utmTerm, "simulatore trading");

    const metaAds = classifyTrafficSource({
      search: "?fbclid=IwAR123456",
      referrer: "https://l.instagram.com/",
    });
    assert.equal(metaAds.channel, "paid_sem");
    assert.equal(metaAds.fbclid, "IwAR123456");
  });

  it("classifies Organic Search, Social, Referral, and Direct traffic accurately", () => {
    const organic = classifyTrafficSource({
      search: "",
      referrer: "https://www.google.it/search?q=aureus+protocol",
    });
    assert.equal(organic.channel, "organic_search");
    assert.equal(organic.referrerHost, "www.google.it");

    const social = classifyTrafficSource({
      search: "",
      referrer: "https://t.me/aureus_order",
    });
    assert.equal(social.channel, "social");

    const internalReload = classifyTrafficSource({
      search: "",
      referrer: "https://aureus-os.app/it",
    });
    assert.equal(internalReload.channel, "direct");
    assert.equal(internalReload.referrerHost, null);
  });

  it("ignores internal aureus-os.app referrers in extractReferrerHost and detects AI engines via utm_source", () => {
    assert.equal(extractReferrerHost("https://aureus-os.app/it/libro-della-verita"), null);
    assert.equal(extractReferrerHost("https://perplexity.ai/"), "perplexity.ai");
    assert.equal(detectAiEngine(null, "perplexity"), "perplexity");
  });
});
