import assert from "node:assert/strict";
import { getLifecycleCopy, LIFECYCLE_LANGUAGES } from "./lifecycleCopy.js";
import {
  buildWelcomeEmail,
  buildDigestEmail,
  buildWinbackEmail,
  type DigestStats,
} from "./lifecycleEmailContent.js";

// Finding 4.1: pure lifecycle email builders — data + localized copy →
// { subject, html, text }. No I/O, fully unit-testable (mirrors
// ticketEmailContent.ts). The I/O send wrappers live in lifecycleEmails.ts.

const baseUrl = "https://traderloading.com";

// Every language resolves to a full copy object.
for (const lang of LIFECYCLE_LANGUAGES) {
  const copy = getLifecycleCopy(lang);
  assert.ok(copy.welcome.title && copy.digest.title && copy.winback.title, `copy complete for ${lang}`);
}

// ── Welcome ──────────────────────────────────────────────────────────────────
{
  const copy = getLifecycleCopy("en");
  const email = buildWelcomeEmail({ copy, lang: "en", baseUrl });
  assert.ok(email.subject.length > 0);
  assert.doesNotMatch(email.subject, /[\r\n]/, "subject has no CR/LF (header injection)");
  assert.match(email.html, /<!doctype html>/i, "renders the branded layout");
  assert.ok(email.html.includes(copy.welcome.title));
  assert.ok(email.text.includes(copy.welcome.title), "text part carries the title");
  assert.ok(email.html.includes(baseUrl), "CTA links back to the app");
}

// ── Digest ───────────────────────────────────────────────────────────────────
{
  const copy = getLifecycleCopy("en");
  const stats: DigestStats = {
    tradesLogged: 12,
    winRate: 0.5833,
    netR: 3.4,
    streakDays: 4,
    topSymbol: "EURUSD",
  };
  const email = buildDigestEmail({ copy, lang: "en", baseUrl, stats });
  assert.ok(email.subject.includes("12"), "subject reflects the trade count");
  assert.ok(email.html.includes("58%"), "win rate rendered as a rounded percent");
  assert.ok(email.html.includes("+3.4R"), "net R rendered with sign + unit");
  assert.ok(email.html.includes("EURUSD"), "top symbol shown");
  assert.ok(email.text.includes("EURUSD"));
}

// Digest with no trades falls back to the empty-week copy, not a bogus 0% row.
{
  const copy = getLifecycleCopy("en");
  const stats: DigestStats = {
    tradesLogged: 0,
    winRate: null,
    netR: 0,
    streakDays: 0,
    topSymbol: null,
  };
  const email = buildDigestEmail({ copy, lang: "en", baseUrl, stats });
  assert.ok(email.html.includes(copy.digest.empty), "empty-week copy shown");
  assert.doesNotMatch(email.html, /NaN|null|undefined/, "no leaked null/NaN");
}

// Negative net R keeps its sign.
{
  const copy = getLifecycleCopy("it");
  const stats: DigestStats = { tradesLogged: 3, winRate: 0.333, netR: -1.2, streakDays: 0, topSymbol: "XAUUSD" };
  const email = buildDigestEmail({ copy, lang: "it", baseUrl, stats });
  assert.ok(email.html.includes("-1.2R"), "losing week shows a negative R");
}

// ── Win-back ─────────────────────────────────────────────────────────────────
{
  const copy = getLifecycleCopy("en");
  const email = buildWinbackEmail({ copy, lang: "en", baseUrl, idleDays: 21 });
  assert.ok(email.subject.length > 0);
  assert.doesNotMatch(email.subject, /[\r\n]/);
  assert.ok(email.html.includes("21"), "idle days surfaced in the copy");
  assert.match(email.html, /<!doctype html>/i);
}

console.log("lifecycle email content checks passed");
