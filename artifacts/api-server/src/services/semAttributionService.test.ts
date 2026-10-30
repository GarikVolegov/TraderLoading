import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  recordSemAttribution,
  getExpansionTelemetryStats,
  semRecordInputSchema,
} from "./semAttributionService.js";

describe("semAttributionService", () => {
  it("validates valid input payload through Zod schema", () => {
    const valid = semRecordInputSchema.parse({
      channel: "ai_search",
      aiEngine: "perplexity",
      landingPath: "/it/backtest",
      utmSource: "perplexity.ai",
    });
    assert.equal(valid.channel, "ai_search");
    assert.equal(valid.aiEngine, "perplexity");
    assert.equal(valid.landingPath, "/it/backtest");
  });

  it("records SEM attribution safely into memory fallback when DB is offline", async () => {
    const result = await recordSemAttribution({
      channel: "paid_sem",
      gclid: "test_gclid_12345",
      utmCampaign: "aureus_forgia_launch",
      landingPath: "/it/prezzi",
    });

    assert.equal(result.success, true);

    const stats = await getExpansionTelemetryStats();
    assert.ok(typeof stats.totalTracked === "number");
    assert.ok(stats.byChannel !== undefined);
  });
});
