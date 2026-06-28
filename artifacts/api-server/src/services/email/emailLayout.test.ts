import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BRAND,
  escapeHtml,
  renderEmailLayout,
  renderText,
} from "./emailLayout.js";

const baseUrl = "https://app.example.com";

test("escapeHtml neutralizes HTML-significant characters", () => {
  const escaped = escapeHtml(`<script>alert("x&y")</script>`);
  assert.ok(!escaped.includes("<script>"));
  assert.match(escaped, /&lt;script&gt;/);
  assert.match(escaped, /&amp;/);
  assert.match(escaped, /&quot;/);
});

test("renderEmailLayout uses the dark brand background and absolute PNG logo", () => {
  const html = renderEmailLayout({
    title: "Titolo",
    bodyHtml: "<p>corpo</p>",
    baseUrl,
  });
  assert.ok(html.includes(BRAND.bg), "dark background hex present");
  assert.ok(
    html.includes(`${baseUrl}/app-icon-192.png`),
    "absolute PNG logo URL present",
  );
  assert.match(html, /<!doctype html>/i);
});

test("renderEmailLayout renders the title and body fragment", () => {
  const html = renderEmailLayout({
    title: "Il tuo ticket",
    bodyHtml: "<p>messaggio del corpo</p>",
    baseUrl,
  });
  assert.ok(html.includes("Il tuo ticket"));
  assert.ok(html.includes("<p>messaggio del corpo</p>"));
});

test("renderEmailLayout with a CTA emits the link, label and an MSO fallback", () => {
  const html = renderEmailLayout({
    title: "Apri",
    bodyHtml: "<p>x</p>",
    ctaLabel: "Vai al ticket",
    ctaUrl: `${baseUrl}/support/42`,
    baseUrl,
  });
  assert.ok(html.includes(`${baseUrl}/support/42`));
  assert.ok(html.includes("Vai al ticket"));
  assert.match(html, /<!--\[if mso\]>/);
});

test("renderEmailLayout without a CTA omits the button URL", () => {
  const html = renderEmailLayout({
    title: "Apri",
    bodyHtml: "<p>x</p>",
    baseUrl,
  });
  assert.ok(!html.includes("/support/42"));
});

test("renderEmailLayout sets the html lang attribute", () => {
  const html = renderEmailLayout({
    title: "x",
    bodyHtml: "<p>x</p>",
    baseUrl,
    lang: "en",
  });
  assert.match(html, /<html[^>]*lang="en"/);
});

test("renderText produces a plain-text twin with the CTA url", () => {
  const text = renderText({
    title: "Il tuo ticket",
    bodyText: "messaggio",
    ctaLabel: "Apri",
    ctaUrl: `${baseUrl}/support/42`,
  });
  assert.ok(text.includes("Il tuo ticket"));
  assert.ok(text.includes("messaggio"));
  assert.ok(text.includes(`${baseUrl}/support/42`));
  assert.ok(!text.includes("<"), "no HTML tags in the text twin");
});
