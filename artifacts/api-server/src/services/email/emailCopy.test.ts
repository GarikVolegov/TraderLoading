import assert from "node:assert/strict";
import { test } from "node:test";
import { EMAIL_LANGUAGES, getEmailCopy } from "./emailCopy.js";

const FORBIDDEN = /[ÃâÂð]/; // mojibake guard: Ã â Â ð

function collectStrings(lang: string): string[] {
  const c = getEmailCopy(lang);
  return [
    c.cta,
    c.footer,
    c.greeting,
    c.ticketCreated.title,
    c.ticketCreated.subject(42),
    c.ticketCreated.intro("Problema login"),
    c.ticketReply.title,
    c.ticketReply.subject("Problema login"),
    c.ticketReply.intro("Problema login"),
    c.ticketStatus.subject("Chiuso"),
    c.ticketStatus.title("Chiuso"),
    c.ticketStatus.intro("Problema login", "Chiuso"),
    c.statusLabel("open"),
    c.statusLabel("pending"),
    c.statusLabel("closed"),
  ];
}

test("every language exposes complete, non-empty email copy", () => {
  for (const lang of EMAIL_LANGUAGES) {
    for (const value of collectStrings(lang)) {
      assert.equal(typeof value, "string");
      assert.ok(value.trim().length > 0, `empty copy in ${lang}`);
    }
  }
});

test("email copy contains no mojibake characters", () => {
  for (const lang of EMAIL_LANGUAGES) {
    for (const value of collectStrings(lang)) {
      assert.ok(!FORBIDDEN.test(value), `mojibake in ${lang}: ${value}`);
    }
  }
});

test("unknown language falls back to Italian", () => {
  assert.equal(getEmailCopy("zz").cta, getEmailCopy("it").cta);
});

test("reply subject is prefixed and status label localizes", () => {
  assert.match(getEmailCopy("it").ticketReply.subject("Ciao"), /Ciao/);
  assert.notEqual(
    getEmailCopy("en").statusLabel("closed"),
    getEmailCopy("it").statusLabel("closed"),
  );
});
