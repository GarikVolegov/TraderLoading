# SEO GEO Public Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a crawlable, multilingual public SEO/GEO hub for TraderLoading while keeping private app routes private.

**Architecture:** Add a typed content registry, a metadata helper, a reusable public SEO page, language-prefixed routes, crawlable landing links, and updated discovery assets. The first release stays inside the existing React/Vite/Wouter app and defers prerendering until indexing data proves it is needed.

**Tech Stack:** React, Vite, Wouter, TypeScript, static `tsx` tests, XML sitemap, Schema.org JSON-LD.

---

## File Structure

- Create `artifacts/trader-dashboard/src/pages/publicSeoContent.ts`: source of truth for public SEO topics, localized slugs, visible copy, FAQs, and metadata.
- Create `artifacts/trader-dashboard/src/pages/PublicSeoPage.tsx`: shared public page renderer.
- Create `artifacts/trader-dashboard/src/lib/publicSeoMeta.ts`: DOM helper for title, meta, canonical, alternates, Open Graph, Twitter, and JSON-LD.
- Create `artifacts/trader-dashboard/src/pages/publicSeoContent.static.test.ts`: registry coverage tests.
- Create `artifacts/trader-dashboard/src/pages/PublicSeoPage.static.test.ts`: route and renderer tests.
- Create `artifacts/trader-dashboard/src/lib/publicSeoMeta.static.test.ts`: metadata helper tests.
- Create `artifacts/trader-dashboard/src/public-seo-assets.static.test.ts`: sitemap, robots, and `llms.txt` tests.
- Modify `artifacts/trader-dashboard/src/App.tsx`: register public SEO routes before the signed-out catch-all.
- Modify `artifacts/trader-dashboard/src/pages/LandingPage.tsx`: add crawlable anchors to public guides.
- Modify `artifacts/trader-dashboard/src/pages/Legal.public.static.test.mjs`: assert landing public guide anchors.
- Modify `artifacts/trader-dashboard/public/sitemap.xml`, `robots.txt`, and `llms.txt`.

## Task 1: Public SEO Content Registry

**Files:**
- Create: `artifacts/trader-dashboard/src/pages/publicSeoContent.ts`
- Test: `artifacts/trader-dashboard/src/pages/publicSeoContent.static.test.ts`

- [ ] **Step 1: Write the failing test**

Create `publicSeoContent.static.test.ts` with assertions that:

```ts
import assert from "node:assert/strict";
import {
  PUBLIC_SEO_LANGUAGES,
  PUBLIC_SEO_TOPICS,
  getPublicSeoPageByPath,
  getPublicSeoPages,
  publicSeoTopics,
} from "./publicSeoContent";

assert.deepEqual(PUBLIC_SEO_LANGUAGES, ["it", "en", "es", "fr", "de"]);
assert.deepEqual(PUBLIC_SEO_TOPICS, [
  "trading-journal",
  "mt5-trading-journal",
  "fx-blue-account-sync",
  "position-size-calculator",
  "forex-backtesting",
  "macro-news-trading",
  "trading-risk-management",
]);

const pages = getPublicSeoPages();
assert.equal(pages.length, PUBLIC_SEO_LANGUAGES.length * PUBLIC_SEO_TOPICS.length);

for (const topicId of PUBLIC_SEO_TOPICS) {
  const topic = publicSeoTopics[topicId];
  assert.ok(topic.globalFeatureFacts.includes("No financial advice or trading signals"));
  assert.ok(topic.globalFeatureFacts.includes("No order placement from TraderLoading"));
  for (const lang of PUBLIC_SEO_LANGUAGES) {
    const page = topic.locales[lang];
    assert.equal(page.topicId, topicId);
    assert.equal(page.language, lang);
    assert.match(page.path, new RegExp(`^/${lang}/[a-z0-9-]+$`));
    assert.ok(page.title.includes("TraderLoading"));
    assert.ok(page.description.length >= 110 && page.description.length <= 165);
    assert.ok(page.sections.length >= 4);
    assert.ok(page.faqs.length >= 4);
    assert.equal(page.cta.href, "/sign-up");
    assert.doesNotMatch(JSON.stringify(page), /guaranteed profit|profitto garantito|investment advice/i);
  }
}

assert.equal(getPublicSeoPageByPath("/it/diario-trading")?.topicId, "trading-journal");
assert.equal(getPublicSeoPageByPath("/en/trading-risk-management")?.language, "en");

console.log("public SEO content registry checks passed");
```

- [ ] **Step 2: Run red**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/pages/publicSeoContent.static.test.ts`

Expected: FAIL because `publicSeoContent.ts` is missing.

- [ ] **Step 3: Implement the registry**

Create `publicSeoContent.ts` exporting:

```ts
export const PUBLIC_SEO_LANGUAGES = ["it", "en", "es", "fr", "de"] as const;
export type PublicSeoLanguage = (typeof PUBLIC_SEO_LANGUAGES)[number];

export const PUBLIC_SEO_TOPICS = [
  "trading-journal",
  "mt5-trading-journal",
  "fx-blue-account-sync",
  "position-size-calculator",
  "forex-backtesting",
  "macro-news-trading",
  "trading-risk-management",
] as const;
export type PublicSeoTopicId = (typeof PUBLIC_SEO_TOPICS)[number];

export type PublicSeoPage = {
  topicId: PublicSeoTopicId;
  language: PublicSeoLanguage;
  path: string;
  slug: string;
  title: string;
  description: string;
  ogLocale: string;
  heroTitle: string;
  heroLead: string;
  answerSummary: string;
  sections: Array<{ heading: string; body: string }>;
  faqs: Array<{ question: string; answer: string }>;
  cta: { label: string; href: "/sign-up" };
};

export type PublicSeoTopic = {
  id: PublicSeoTopicId;
  globalFeatureFacts: string[];
  locales: Record<PublicSeoLanguage, PublicSeoPage>;
};
```

Implement `publicSeoTopics`, `getPublicSeoPages()`, and `getPublicSeoPageByPath(path)`. Include all seven topics in all five languages. Required slugs:

```ts
{
  it: ["diario-trading", "trading-journal-mt5", "fx-blue-account-sync", "calcolatore-lotto-trading", "backtesting-forex", "news-macro-trading", "risk-management-trading"],
  en: ["trading-journal", "mt5-trading-journal", "fx-blue-account-sync", "position-size-calculator", "forex-backtesting", "macro-news-trading", "trading-risk-management"],
  es: ["diario-trading", "journal-trading-mt5", "fx-blue-account-sync", "calculadora-lotaje-trading", "backtesting-forex", "noticias-macro-trading", "gestion-riesgo-trading"],
  fr: ["journal-trading", "journal-trading-mt5", "fx-blue-account-sync", "calculateur-taille-position", "backtesting-forex", "actualites-macro-trading", "gestion-risque-trading"],
  de: ["trading-journal", "mt5-trading-journal", "fx-blue-account-sync", "positionsgroesse-rechner", "forex-backtesting", "makro-news-trading", "trading-risikomanagement"],
}
```

Every page description must be 110-165 characters, every page must have at least four sections and four FAQs, and every topic must include these global facts:

```ts
[
  "Read-only broker sync where account sync is used",
  "No order placement from TraderLoading",
  "No financial advice or trading signals",
  "Free to start with optional Pro upgrade",
]
```

- [ ] **Step 4: Run green**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/pages/publicSeoContent.static.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add artifacts/trader-dashboard/src/pages/publicSeoContent.ts artifacts/trader-dashboard/src/pages/publicSeoContent.static.test.ts
git commit -m "feat(seo): add public seo content registry"
```

## Task 2: Public SEO Metadata Helper

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/publicSeoMeta.ts`
- Test: `artifacts/trader-dashboard/src/lib/publicSeoMeta.static.test.ts`

- [ ] **Step 1: Write the failing test**

Create a static test that reads `publicSeoMeta.ts` and asserts it contains `applyPublicSeoMeta`, `clearPublicSeoMeta`, `rel="canonical"`, `rel="alternate"`, `hreflang`, `og:title`, `og:description`, `og:url`, `twitter:title`, `application/ld+json`, and `public-seo-jsonld`.

- [ ] **Step 2: Run red**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/lib/publicSeoMeta.static.test.ts`

Expected: FAIL because the helper is missing.

- [ ] **Step 3: Implement the helper**

Create `publicSeoMeta.ts` with:

```ts
import type { PublicSeoPage } from "@/pages/publicSeoContent";

const SITE_URL = "https://traderloading.com";
const OG_IMAGE = `${SITE_URL}/opengraph.jpg`;
const MANAGED_SELECTOR = "[data-public-seo-managed='true']";

export type PublicSeoAlternate = { hreflang: string; href: string };
export type PublicSeoMetaInput = {
  page: PublicSeoPage;
  alternates: PublicSeoAlternate[];
  jsonLd: unknown[];
};

function setManagedAttr(element: HTMLElement) {
  element.dataset.publicSeoManaged = "true";
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let element = document.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    setManagedAttr(element);
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
}

function appendLink(rel: string, attrs: Record<string, string>) {
  const link = document.createElement("link");
  link.rel = rel;
  setManagedAttr(link);
  Object.entries(attrs).forEach(([key, value]) => link.setAttribute(key, value));
  document.head.appendChild(link);
}

export function clearPublicSeoMeta() {
  document.querySelectorAll(MANAGED_SELECTOR).forEach((node) => node.remove());
}

export function applyPublicSeoMeta({ page, alternates, jsonLd }: PublicSeoMetaInput) {
  clearPublicSeoMeta();
  const url = `${SITE_URL}${page.path}`;
  document.documentElement.lang = page.language;
  document.title = page.title;

  upsertMeta('meta[name="description"]', { name: "description", content: page.description });
  upsertMeta('meta[name="robots"]', { name: "robots", content: "index, follow, max-image-preview:large" });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: page.title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: page.description });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: url });
  upsertMeta('meta[property="og:image"]', { property: "og:image", content: OG_IMAGE });
  upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: page.ogLocale });
  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: page.title });
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: page.description });
  upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: OG_IMAGE });

  appendLink("canonical", { href: url });
  alternates.forEach((alternate) => appendLink("alternate", alternate));

  const script = document.createElement("script");
  script.id = "public-seo-jsonld";
  script.type = "application/ld+json";
  setManagedAttr(script);
  script.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(script);
}
```

- [ ] **Step 4: Run green**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/lib/publicSeoMeta.static.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add artifacts/trader-dashboard/src/lib/publicSeoMeta.ts artifacts/trader-dashboard/src/lib/publicSeoMeta.static.test.ts
git commit -m "feat(seo): add public seo metadata helper"
```

## Task 3: Public Page Renderer and Routes

**Files:**
- Create: `artifacts/trader-dashboard/src/pages/PublicSeoPage.tsx`
- Modify: `artifacts/trader-dashboard/src/App.tsx`
- Test: `artifacts/trader-dashboard/src/pages/PublicSeoPage.static.test.ts`

- [ ] **Step 1: Write the failing test**

Create a static test that reads `App.tsx` and `PublicSeoPage.tsx`. Assert `App.tsx` imports `getPublicSeoPages`, lazy-loads `PublicSeoPage`, maps `getPublicSeoPages().map`, and passes `page={page}`. Assert `PublicSeoPage.tsx` contains `applyPublicSeoMeta`, `clearPublicSeoMeta`, `SoftwareApplication`, `FAQPage`, `BreadcrumbList`, `No financial advice`, `<h1`, `<section`, and `href={page.cta.href}`.

- [ ] **Step 2: Run red**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/pages/PublicSeoPage.static.test.ts`

Expected: FAIL because route and renderer are missing.

- [ ] **Step 3: Implement the renderer**

Create `PublicSeoPage.tsx` that:

- Accepts `{ page: PublicSeoPage }`.
- Builds alternates from `publicSeoTopics[page.topicId].locales`.
- Adds `x-default` pointing to the English locale.
- Builds JSON-LD for `SoftwareApplication`, `FAQPage`, and `BreadcrumbList`.
- Calls `applyPublicSeoMeta` in `useEffect` and `clearPublicSeoMeta` on cleanup.
- Renders visible `h1`, direct answer section, all sections, all FAQ items, a "No financial advice" trust block, and a CTA anchor to `/sign-up`.

- [ ] **Step 4: Register routes in `App.tsx`**

Add:

```tsx
import { getPublicSeoPages } from "./pages/publicSeoContent";
const PublicSeoPage = lazy(() => import("./pages/PublicSeoPage"));
```

In the public signed-out route switch, before the catch-all `AppShell` route, add:

```tsx
{getPublicSeoPages().map((page) => (
  <Route key={page.path} path={page.path}>
    <Suspense fallback={<PageFallback />}>
      <PublicSeoPage page={page} />
    </Suspense>
  </Route>
))}
```

- [ ] **Step 5: Run green**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/pages/PublicSeoPage.static.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add artifacts/trader-dashboard/src/pages/PublicSeoPage.tsx artifacts/trader-dashboard/src/pages/PublicSeoPage.static.test.ts artifacts/trader-dashboard/src/App.tsx
git commit -m "feat(seo): add public seo pages and routes"
```

## Task 4: Crawlable Landing Links

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/LandingPage.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Legal.public.static.test.mjs`

- [ ] **Step 1: Write failing assertions**

Extend `Legal.public.static.test.mjs` to assert `LandingPage.tsx` contains these crawlable anchors:

```ts
[
  "/it/diario-trading",
  "/en/trading-journal",
  "/en/mt5-trading-journal",
  "/en/fx-blue-account-sync",
  "/en/forex-backtesting",
  "/en/trading-risk-management",
].forEach((href) => {
  assert.match(landingSource, new RegExp(`href="${href}"`));
});
```

- [ ] **Step 2: Run red**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/pages/Legal.public.static.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add anchors**

Add a compact footer nav in `LandingPage.tsx` with regular `<a href="...">` links for the six URLs above. Use existing footer styling and keep the nav near Privacy/Terms links.

- [ ] **Step 4: Run green**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/pages/Legal.public.static.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add artifacts/trader-dashboard/src/pages/LandingPage.tsx artifacts/trader-dashboard/src/pages/Legal.public.static.test.mjs
git commit -m "feat(seo): add crawlable public guide links"
```

## Task 5: Sitemap, Robots, and LLM Summary

**Files:**
- Modify: `artifacts/trader-dashboard/public/sitemap.xml`
- Modify: `artifacts/trader-dashboard/public/robots.txt`
- Modify: `artifacts/trader-dashboard/public/llms.txt`
- Test: `artifacts/trader-dashboard/src/public-seo-assets.static.test.ts`

- [ ] **Step 1: Write failing asset test**

Create `public-seo-assets.static.test.ts` that:

- Imports `getPublicSeoPages`, `PUBLIC_SEO_LANGUAGES`, `PUBLIC_SEO_TOPICS`, and `publicSeoTopics`.
- Asserts sitemap has `xmlns:xhtml="http://www.w3.org/1999/xhtml"`.
- Asserts every public page has a `<loc>https://traderloading.com${page.path}</loc>`.
- Asserts every topic has `hreflang` links for all five languages.
- Asserts robots allows `/it/`, `/en/`, `/es/`, `/fr/`, `/de/`.
- Asserts robots still disallows `/journal`, `/backtest`, `/settings`, and `/api/`.
- Asserts `llms.txt` contains `Public SEO pages`, `read-only`, `No financial advice`, `https://traderloading.com/en/trading-journal`, and `https://traderloading.com/it/diario-trading`.

- [ ] **Step 2: Run red**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/public-seo-assets.static.test.ts`

Expected: FAIL.

- [ ] **Step 3: Update robots**

Add:

```txt
Allow: /it/
Allow: /en/
Allow: /es/
Allow: /fr/
Allow: /de/
```

Keep existing private route disallows.

- [ ] **Step 4: Update sitemap**

Add the XHTML namespace and entries for every public SEO page with `lastmod` set to `2026-06-11`. Each public SEO URL must include five self/alternate language links and one `x-default` link to the English version.

- [ ] **Step 5: Update `llms.txt`**

Add a `Public SEO pages` section listing the English and Italian core guide URLs plus these facts: read-only broker sync where account sync is configured, no order placement, no financial advice, no trading signals, free to start, optional Pro plan.

- [ ] **Step 6: Run green**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/public-seo-assets.static.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add artifacts/trader-dashboard/public/sitemap.xml artifacts/trader-dashboard/public/robots.txt artifacts/trader-dashboard/public/llms.txt artifacts/trader-dashboard/src/public-seo-assets.static.test.ts
git commit -m "feat(seo): publish multilingual discovery assets"
```

## Task 6: Full Verification

**Files:**
- No planned source edits unless verification exposes failures.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/pages/publicSeoContent.static.test.ts
pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/lib/publicSeoMeta.static.test.ts
pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/pages/PublicSeoPage.static.test.ts
pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/pages/Legal.public.static.test.mjs
pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/public-seo-assets.static.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full tests**

Run: `pnpm run test`

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 4: Build frontend**

Run: `pnpm --filter @workspace/trader-dashboard build`

Expected: PASS and output in `artifacts/trader-dashboard/dist/public`.

- [ ] **Step 5: Commit verification fixes**

If verification required code changes, commit the exact touched files:

```bash
git add artifacts/trader-dashboard/src artifacts/trader-dashboard/public
git commit -m "fix(seo): satisfy public seo verification"
```

If no files changed, do not create a commit.

## Post-Deploy Manual Steps

- Submit `https://traderloading.com/sitemap.xml` in Google Search Console.
- Request indexing for `/it/diario-trading`, `/en/trading-journal`, `/en/mt5-trading-journal`, `/en/fx-blue-account-sync`, `/en/forex-backtesting`, and `/en/trading-risk-management`.
- Submit the same sitemap in Bing Webmaster Tools.
- Monitor Bing AI Performance citation data when available.
- Decide on prerendering after 2-4 weeks of indexing data.

## Self-Review Notes

- Spec coverage: public routes, localized slugs, metadata, hreflang, JSON-LD, sitemap, robots, `llms.txt`, landing links, safety copy, and verification are each mapped to tasks.
- Risk handling: private routes stay disallowed, no street address is invented, and tests block investment-advice wording.
- Type consistency: `PublicSeoPage`, `PublicSeoTopic`, `getPublicSeoPages`, and `getPublicSeoPageByPath` are introduced in Task 1 and reused by later tasks.
