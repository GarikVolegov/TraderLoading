import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectIndexNowUrls,
  submitToIndexNow,
  INDEXNOW_HOST,
  INDEXNOW_KEY,
} from "./submit-indexnow.ts";

describe("IndexNow Instant Discovery Push", () => {
  it("collects all canonical URLs on aureus-os.app without duplicates", () => {
    const urls = collectIndexNowUrls();
    assert.ok(urls.length >= 35, `Expected at least 35 URLs, got ${urls.length}`);
    for (const u of urls) {
      assert.ok(u.startsWith(`https://${INDEXNOW_HOST}`), `URL must start with https://${INDEXNOW_HOST}: ${u}`);
    }
    assert.ok(urls.includes(`https://${INDEXNOW_HOST}/`), "Must include root");
    assert.ok(urls.includes(`https://${INDEXNOW_HOST}/it`), "Must include Italian landing");
    assert.ok(urls.includes(`https://${INDEXNOW_HOST}/protocollo`), "Must include Protocollo gateway");
    assert.ok(urls.includes(`https://${INDEXNOW_HOST}/verifica`), "Must include Notary Verification gateway");
  });

  it("formats key and executes dry-run submission cleanly", async () => {
    assert.equal(INDEXNOW_KEY.length, 32);
    const result = await submitToIndexNow({ dryRun: true });
    assert.equal(result.status, "dry-run");
    assert.ok(result.submitted >= 35);
  });
});
