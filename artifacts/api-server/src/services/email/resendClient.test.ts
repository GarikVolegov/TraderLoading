import assert from "node:assert/strict";
import { test } from "node:test";
import { getEmailClient, isEmailConfigured, sendEmail } from "./resendClient.js";

test("isEmailConfigured is false without an API key", () => {
  delete process.env.RESEND_API_KEY;
  assert.equal(isEmailConfigured(), false);
});

test("getEmailClient returns null without an API key", () => {
  delete process.env.RESEND_API_KEY;
  assert.equal(getEmailClient(), null);
});

test("sendEmail degrades gracefully (no throw) when unconfigured", async () => {
  delete process.env.RESEND_API_KEY;
  const result = await sendEmail({
    to: "a@b.com",
    subject: "x",
    html: "<p>x</p>",
    text: "x",
  });
  assert.deepEqual(result, { sent: false });
});
