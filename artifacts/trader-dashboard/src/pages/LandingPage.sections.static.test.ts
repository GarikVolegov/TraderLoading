import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The landing page is a faithful port of the Claude Design marketing kit:
// hero + live product mock, animated stats, bento features, how-it-works,
// product showcase, testimonials, pricing, FAQ, final CTA and footer sitemap.
// This guards against silently regressing back to the old hero-only layout.

const src = readFileSync(new URL("./LandingPage.tsx", import.meta.url), "utf8");

// In-page anchor navigation must target real sections (functional smooth-scroll).
for (const id of ['id="features"', 'id="how"', 'id="pricing"', 'id="faq"']) {
  assert.ok(src.includes(id), `landing must keep the ${id} section anchor`);
}
for (const hash of ['"#features"', '"#how"', '"#pricing"', '"#faq"']) {
  assert.ok(src.includes(hash), `landing nav must link to ${hash}`);
}

// Animated count-up stats bar (now fed by real public stats).
assert.match(src, /usePublicStats/);
assert.match(src, /function CountUp/);
assert.match(src, /IntersectionObserver/);

// Real, live data: stats + testimonials from public endpoints, live macro news.
assert.match(src, /\/api\/public\/stats/);
assert.match(src, /\/api\/public\/testimonials/);
assert.match(src, /\/api\/tools\/macro-news/);
assert.match(src, /usePublicTestimonials/);
assert.match(src, /useLandingNews/);

// Live, real product mock: ticking clock + actual market session (not a dead mock).
assert.match(src, /function ProductMock/);
assert.match(src, /function getActiveSession/);
assert.match(src, /format\(now, "HH:mm:ss"\)/);
assert.match(src, /setInterval/);

// Bento features (with the 2x2 big card) + how-it-works + showcase rows.
assert.match(src, /\bFEATURES\b/);
assert.match(src, /\bSTEPS\b/);
const showcaseRows = [...src.matchAll(/<ShowcaseRow/g)].length;
assert.ok(showcaseRows >= 3, `expected 3 showcase rows, found ${showcaseRows}`);

// Testimonials (real, hidden when none), final CTA and footer sitemap.
assert.match(src, /testimonials\.length > 0/);
assert.match(src, /landing\.cta\.title/);
assert.match(src, /\bFOOTER_COLS\b/);

// Every showcase/section string is routed through i18n.
assert.match(src, /landing\.stats\./);
assert.match(src, /landing\.showcase\./);
assert.match(src, /landing\.testimonials\./);

// The hero keeps both translated CTAs wired to real routes.
assert.match(src, /setLocation\("\/sign-up"\)/);
assert.match(src, /setLocation\("\/sign-in"\)/);

console.log("landing sections static checks passed");
