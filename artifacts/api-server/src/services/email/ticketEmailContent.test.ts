import assert from "node:assert/strict";
import { test } from "node:test";
import { BRAND } from "./emailLayout.js";
import { getEmailCopy } from "./emailCopy.js";
import {
  buildTicketCreatedEmail,
  buildTicketReplyEmail,
  buildTicketStatusEmail,
} from "./ticketEmailContent.js";

const baseUrl = "https://app.example.com";

test("reply email escapes the body, links the ticket and prefixes the subject", () => {
  const out = buildTicketReplyEmail({
    copy: getEmailCopy("it"),
    lang: "it",
    baseUrl,
    ticketId: 42,
    ticketSubject: "Problema login",
    replyBody: `<script>alert(1)</script>\nseconda riga`,
  });
  assert.match(out.subject, /^Re: Problema login/);
  assert.ok(out.html.includes(`${baseUrl}/support/42`));
  assert.ok(!out.html.includes("<script>"), "user HTML is escaped");
  assert.ok(out.html.includes("seconda riga"));
  assert.ok(out.html.includes(BRAND.bg), "dark background");
  assert.ok(out.text.includes(`${baseUrl}/support/42`));
});

test("reply preserves newlines as <br> in the quoted body", () => {
  const out = buildTicketReplyEmail({
    copy: getEmailCopy("it"),
    lang: "it",
    baseUrl,
    ticketId: 1,
    ticketSubject: "X",
    replyBody: "riga uno\nriga due",
  });
  assert.match(out.html, /riga uno<br>riga due/);
});

test("created email subject carries the ticket id and links the thread", () => {
  const out = buildTicketCreatedEmail({
    copy: getEmailCopy("en"),
    lang: "en",
    baseUrl,
    ticketId: 7,
    ticketSubject: "Hi",
  });
  assert.match(out.subject, /#7/);
  assert.ok(out.html.includes(`${baseUrl}/support/7`));
  assert.match(out.html, /lang="en"/);
});

test("status email surfaces the localized status label", () => {
  const it = getEmailCopy("it");
  const out = buildTicketStatusEmail({
    copy: it,
    lang: "it",
    baseUrl,
    ticketId: 3,
    ticketSubject: "X",
    status: "closed",
  });
  assert.ok(out.subject.includes(it.statusLabel("closed")));
  assert.ok(out.html.includes(it.statusLabel("closed")));
});

test("subject lines are sanitized against header injection", () => {
  const out = buildTicketReplyEmail({
    copy: getEmailCopy("it"),
    lang: "it",
    baseUrl,
    ticketId: 1,
    ticketSubject: "line1\nline2",
    replyBody: "x",
  });
  assert.ok(!out.subject.includes("\n"));
  assert.ok(!out.subject.includes("\r"));
});
