import assert from "node:assert/strict";
import type { Event } from "@sentry/node";

import { scrubSentryEvent, reportJobError } from "./observability.js";

// Finding 2.6: the logger redacts Authorization/cookie/token/password/secret, but
// Sentry shipped them to a third party in the clear. beforeSend must scrub the same
// classes of secret before the event leaves the process.

// Request headers: secrets by header name are redacted, ordinary headers survive.
const headerEvent: Event = {
  request: {
    headers: {
      Authorization: "Bearer sk-super-secret",
      Cookie: "__session=leaked-session-cookie",
      Accept: "application/json",
    },
  },
};
const scrubbedHeaders = scrubSentryEvent(headerEvent);
assert.equal(scrubbedHeaders.request?.headers?.Authorization, "[REDACTED]");
assert.equal(scrubbedHeaders.request?.headers?.Cookie, "[REDACTED]");
assert.equal(scrubbedHeaders.request?.headers?.Accept, "application/json");

// Parsed cookies map: names aren't sensitive keys but the values are the secret —
// every value is redacted while the cookie names survive.
const cookieEvent: Event = {
  request: { cookies: { __session: "leaked", other: "also-leaked" } },
};
const scrubbedCookies = scrubSentryEvent(cookieEvent).request?.cookies as Record<string, string>;
assert.equal(scrubbedCookies.__session, "[REDACTED]");
assert.equal(scrubbedCookies.other, "[REDACTED]");

// Request body and captureError `extra` context: sensitive keys redacted at any depth,
// ordinary fields preserved.
const bodyEvent: Event = {
  request: { data: { email: "user@example.com", password: "hunter2", nested: { access_token: "tok" } } },
  extra: { token: "ctx-token", note: "keep me", deep: { clientSecret: "shhh", ok: 1 } },
};
const scrubbedBody = scrubSentryEvent(bodyEvent);
const data = scrubbedBody.request?.data as Record<string, unknown>;
assert.equal(data.email, "user@example.com");
assert.equal(data.password, "[REDACTED]");
assert.equal((data.nested as Record<string, unknown>).access_token, "[REDACTED]");
assert.equal(scrubbedBody.extra?.token, "[REDACTED]");
assert.equal(scrubbedBody.extra?.note, "keep me");
assert.equal((scrubbedBody.extra?.deep as Record<string, unknown>).clientSecret, "[REDACTED]");
assert.equal((scrubbedBody.extra?.deep as Record<string, unknown>).ok, 1);

// An event with nothing sensitive passes through untouched.
const cleanEvent: Event = { message: "boom", request: { headers: { Accept: "text/html" } } };
const cleanResult = scrubSentryEvent(cleanEvent);
assert.equal(cleanResult.message, "boom");
assert.equal(cleanResult.request?.headers?.Accept, "text/html");

// Finding 2.6: critical cron jobs (tornei settle touches XP/Pro/mint) only
// console.error'd, so failures were invisible in Sentry. reportJobError must log
// AND forward to Sentry tagged surface=background with the job name + context.
const captured: Array<{ err: unknown; ctx: Record<string, unknown> }> = [];
reportJobError(new Error("settle blew up"), { job: "tornei-settle", seasonId: "s1" }, (err, ctx) =>
  captured.push({ err, ctx }),
);
assert.equal(captured.length, 1);
assert.equal((captured[0].err as Error).message, "settle blew up");
assert.equal(captured[0].ctx.surface, "background");
assert.equal(captured[0].ctx.job, "tornei-settle");
assert.equal(captured[0].ctx.seasonId, "s1");

console.log("observability scrub checks passed");
