# News Deep Dive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a richer non-AI news deep dive with "what happened", "why it matters", and "possible impact" sections in the news detail dialog.

**Architecture:** Add a deterministic backend helper that converts existing article metadata into a `deepDive` object. Wire the helper into the existing `/api/news` response flow, keep the field optional on the frontend, and render the richer explanation only in the article detail dialog.

**Tech Stack:** TypeScript, Express, React, Vite, static Node assertion tests, `pnpm` workspace scripts.

---

## File Structure

- Create `artifacts/api-server/src/services/newsHub/deepDive.ts`: deterministic deep dive copy generation.
- Create `artifacts/api-server/src/services/newsHub/deepDive.test.ts`: backend unit tests for clear and missing-data article cases.
- Modify `artifacts/api-server/src/services/newsHub/types.ts`: shared `NewsDeepDive` and `NewsArticle.deepDive`.
- Modify `artifacts/api-server/src/routes/news.ts`: local route article type, import helper, attach `deepDive` to final articles.
- Modify `artifacts/trader-dashboard/src/lib/newsApi.ts`: frontend `Article.deepDive` type.
- Modify `artifacts/trader-dashboard/src/pages/News.tsx`: render three deep dive sections in `NewsDetailDialog`.
- Create `artifacts/trader-dashboard/src/pages/News.deep-dive.static.test.ts`: static checks that the dialog renders the new headings and fallback.

### Task 1: Backend Deep Dive Helper

**Files:**
- Create: `artifacts/api-server/src/services/newsHub/deepDive.test.ts`
- Create: `artifacts/api-server/src/services/newsHub/deepDive.ts`
- Modify: `artifacts/api-server/src/services/newsHub/types.ts`

- [ ] **Step 1: Write the failing backend helper test**

Create `artifacts/api-server/src/services/newsHub/deepDive.test.ts`:

```ts
import assert from "node:assert/strict";
import { buildNewsDeepDive } from "./deepDive.js";
import type { NewsArticle } from "./types.js";

function article(input: Partial<NewsArticle> = {}): NewsArticle {
  return {
    title: "US CPI beats expectations as Treasury yields jump",
    summary: "Markets price fewer Fed cuts and a stronger dollar after inflation data.",
    source: "TestWire",
    publishedAt: "2026-06-08T10:00:00.000Z",
    url: "https://example.com/cpi",
    sentiment: "bearish",
    imageUrl: null,
    affectedPairs: ["XAU/USD"],
    primaryAssets: ["XAU", "USD"],
    impactScore: 8,
    impactDirection: "bearish",
    relevanceReason: "Inflazione e CPI influenzano aspettative sui tassi, dollaro e rendimenti reali: sono driver diretti dell'oro/XAU.",
    ...input,
  };
}

const bearish = buildNewsDeepDive(article(), { lang: "it" });
assert.match(bearish.whatHappened, /Markets price fewer Fed cuts/i);
assert.match(bearish.whyItMatters, /XAU\/USD/);
assert.match(bearish.whyItMatters, /Inflazione|CPI|rendimenti/i);
assert.match(bearish.possibleImpact, /pressione ribassista|ribassista/i);
assert.match(bearish.possibleImpact, /XAU\/USD/);

const bullish = buildNewsDeepDive(article({
  title: "Gold rises as dollar weakens",
  summary: "Bullion catches a bid after the dollar retreats.",
  sentiment: "bullish",
  impactDirection: "bullish",
  impactScore: 7,
}), { lang: "it" });
assert.match(bullish.possibleImpact, /sostenere|rialzista/i);

const mixed = buildNewsDeepDive(article({
  impactDirection: "mixed",
  sentiment: "neutral",
  impactScore: 6,
}), { lang: "it" });
assert.match(mixed.possibleImpact, /volatilit/i);

const sparse = buildNewsDeepDive(article({
  title: "Markets wait for central bank signals",
  summary: "",
  relevanceReason: undefined,
  impactReason: undefined,
  affectedPairs: [],
  primaryAssets: [],
  impactDirection: "neutral",
  sentiment: null,
  impactScore: 2,
}), { lang: "it" });
assert.match(sparse.whatHappened, /Markets wait/);
assert.match(sparse.whyItMatters, /mercato|macro|volatil/i);
assert.match(sparse.possibleImpact, /limitato|monitorare|volatilit/i);

const english = buildNewsDeepDive(article(), { lang: "en" });
assert.match(english.whyItMatters, /XAU\/USD/);
assert.match(english.possibleImpact, /bearish pressure|downside pressure|volatility/i);

console.log("news deep dive checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/deepDive.test.ts
```

Expected: FAIL because `./deepDive.js` does not exist.

- [ ] **Step 3: Add the shared type and minimal helper implementation**

Add to `artifacts/api-server/src/services/newsHub/types.ts`:

```ts
export interface NewsDeepDive {
  whatHappened: string;
  whyItMatters: string;
  possibleImpact: string;
}
```

Add `deepDive?: NewsDeepDive;` to `NewsArticle`.

Create `artifacts/api-server/src/services/newsHub/deepDive.ts`:

```ts
import type { NewsArticle, NewsDeepDive } from "./types.js";

export interface NewsDeepDiveContext {
  lang?: string;
}

type Direction = NonNullable<NewsArticle["impactDirection"]>;

function languageOf(lang: string | undefined): "it" | "en" {
  return lang?.toLowerCase().startsWith("en") ? "en" : "it";
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map(clean).filter(Boolean)));
}

function focusLabel(article: NewsArticle, lang: "it" | "en"): string {
  const pairs = unique(article.affectedPairs);
  if (pairs.length > 0) return pairs.join(", ");
  const assets = unique(article.primaryAssets);
  if (assets.length > 0) return assets.join(", ");
  return lang === "it" ? "gli asset collegati" : "the linked assets";
}

function withFocus(reason: string, focus: string, lang: "it" | "en"): string {
  if (!focus || reason.includes(focus)) return reason;
  return lang === "it" ? `${reason} Focus: ${focus}.` : `${reason} Focus: ${focus}.`;
}

function directionOf(article: NewsArticle): Direction {
  if (article.impactDirection === "bullish" || article.sentiment === "bullish") return "bullish";
  if (article.impactDirection === "bearish" || article.sentiment === "bearish") return "bearish";
  if (article.impactDirection === "mixed") return "mixed";
  return "neutral";
}

function possibleImpact(article: NewsArticle, lang: "it" | "en"): string {
  const focus = focusLabel(article, lang);
  const score = article.impactScore ?? 0;
  const direction = directionOf(article);

  if (direction === "bullish") {
    return lang === "it"
      ? `Potrebbe sostenere ${focus} e aumentare la probabilita' di movimenti direzionali se il mercato conferma il driver.`
      : `It could support ${focus} and raise the chance of directional moves if the market confirms the driver.`;
  }
  if (direction === "bearish") {
    return lang === "it"
      ? `Potrebbe aumentare la pressione ribassista su ${focus}, soprattutto se il mercato conferma il driver macro.`
      : `It could add bearish pressure on ${focus}, especially if the market confirms the macro driver.`;
  }
  if (direction === "mixed" || score >= 5) {
    return lang === "it"
      ? `Potrebbe aumentare la volatilita' su ${focus} senza una direzione immediata chiara.`
      : `It could increase volatility in ${focus} without a clear immediate direction.`;
  }
  return lang === "it"
    ? `Impatto probabilmente limitato su ${focus}, ma utile da monitorare se si somma ad altri driver.`
    : `The impact on ${focus} is likely limited, but it is worth monitoring if it combines with other drivers.`;
}

export function buildNewsDeepDive(article: NewsArticle, context: NewsDeepDiveContext = {}): NewsDeepDive {
  const lang = languageOf(context.lang);
  const summary = clean(article.summary);
  const title = clean(article.title);
  const whatHappened = summary && summary.toLowerCase() !== title.toLowerCase() ? summary : title;
  const baseReason = clean(article.relevanceReason) || clean(article.impactReason);
  const whyItMatters = baseReason
    ? withFocus(baseReason, focusLabel(article, lang), lang)
    : lang === "it"
      ? `La notizia puo' incidere sul mercato perche' riguarda driver macro o flussi che possono modificare volatilita' e aspettative sugli asset collegati.`
      : `The article can matter because it touches macro drivers or flows that may change volatility and expectations for the linked assets.`;

  return {
    whatHappened: whatHappened || (lang === "it" ? "La notizia segnala un aggiornamento di mercato da monitorare." : "The article reports a market update worth monitoring."),
    whyItMatters,
    possibleImpact: possibleImpact(article, lang),
  };
}
```

- [ ] **Step 4: Run backend helper test to verify it passes**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/deepDive.test.ts
```

Expected: PASS and prints `news deep dive checks passed`.

### Task 2: Wire Deep Dive Into News API

**Files:**
- Modify: `artifacts/api-server/src/routes/news.ts`
- Test: `artifacts/api-server/src/services/newsHub/deepDive.test.ts`

- [ ] **Step 1: Write the failing API shape assertion**

Append to `artifacts/api-server/src/services/newsHub/deepDive.test.ts`:

```ts
const attached = {
  ...article(),
  deepDive: buildNewsDeepDive(article(), { lang: "it" }),
};
assert.equal(typeof attached.deepDive.whatHappened, "string");
assert.equal(typeof attached.deepDive.whyItMatters, "string");
assert.equal(typeof attached.deepDive.possibleImpact, "string");
```

- [ ] **Step 2: Run the test to verify the helper path remains passing**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/deepDive.test.ts
```

Expected: PASS. This locks the object shape before wiring it into the route.

- [ ] **Step 3: Attach `deepDive` in `getNewsData`**

In `artifacts/api-server/src/routes/news.ts`, import the helper:

```ts
import { buildNewsDeepDive } from "../services/newsHub/deepDive.js";
```

Add the local interface:

```ts
interface NewsDeepDive {
  whatHappened: string;
  whyItMatters: string;
  possibleImpact: string;
}
```

Add `deepDive?: NewsDeepDive;` to the local `NewsArticle` interface.

After final article freshness and sorting, attach the deep dive:

```ts
articles = articles.map((article) => ({
  ...article,
  deepDive: article.deepDive ?? buildNewsDeepDive(article, { lang }),
}));
```

- [ ] **Step 4: Run backend typecheck**

Run:

```bash
pnpm --filter @workspace/api-server run typecheck
```

Expected: PASS with no TypeScript errors from `deepDive`.

### Task 3: Frontend Types And Detail Dialog

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/newsApi.ts`
- Modify: `artifacts/trader-dashboard/src/pages/News.tsx`
- Create: `artifacts/trader-dashboard/src/pages/News.deep-dive.static.test.ts`

- [ ] **Step 1: Write the failing frontend static test**

Create `artifacts/trader-dashboard/src/pages/News.deep-dive.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("./News.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../lib/newsApi.ts", import.meta.url), "utf8");

assert.match(apiSource, /deepDive\?:/);
assert.match(apiSource, /whatHappened: string/);
assert.match(apiSource, /whyItMatters: string/);
assert.match(apiSource, /possibleImpact: string/);

assert.match(pageSource, /Cosa e' successo/);
assert.match(pageSource, /Perche' influenza l'asset/);
assert.match(pageSource, /Come puo' impattare/);
assert.match(pageSource, /article\.deepDive/);
assert.match(pageSource, /Impatto per il trading/);

console.log("news deep dive UI static checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/pages/News.deep-dive.static.test.ts
```

Expected: FAIL because `deepDive` type and headings are not present.

- [ ] **Step 3: Add frontend type**

In `artifacts/trader-dashboard/src/lib/newsApi.ts`, add:

```ts
export interface ArticleDeepDive {
  whatHappened: string;
  whyItMatters: string;
  possibleImpact: string;
}
```

Add `deepDive?: ArticleDeepDive;` to `Article`.

- [ ] **Step 4: Render deep dive sections in `NewsDetailDialog`**

Inside `NewsDetailDialog`, compute:

```ts
const deepDive = article.deepDive;
```

Replace the single explanation panel with a branch that renders `deepDive` when present and preserves the old fallback when absent:

```tsx
{deepDive ? (
  <div className="grid gap-3">
    {[
      ["Cosa e' successo", deepDive.whatHappened],
      ["Perche' influenza l'asset", deepDive.whyItMatters],
      ["Come puo' impattare", deepDive.possibleImpact],
    ].map(([label, value]) => (
      <div key={label} className="rounded-lg border border-primary/15 bg-primary/5 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-primary/80 mb-1">{label}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{value}</p>
      </div>
    ))}
  </div>
) : explanation ? (
  <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
    <p className="text-xs font-bold uppercase tracking-wide text-primary/80 mb-1">Impatto per il trading</p>
    <p className="text-sm text-muted-foreground leading-relaxed">{explanation}</p>
  </div>
) : null}
```

- [ ] **Step 5: Run frontend static test**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/pages/News.deep-dive.static.test.ts
```

Expected: PASS and prints `news deep dive UI static checks passed`.

- [ ] **Step 6: Run frontend typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS with no `Article.deepDive` errors.

### Task 4: Final Verification

**Files:**
- Verify: all files touched above

- [ ] **Step 1: Run targeted backend tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/deepDive.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/intelligence.test.ts
```

Expected: both commands PASS.

- [ ] **Step 2: Run targeted frontend test**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/pages/News.deep-dive.static.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typechecks**

Run:

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: both commands PASS.

- [ ] **Step 4: Inspect scoped diff**

Run:

```bash
git diff -- artifacts/api-server/src/services/newsHub/deepDive.ts artifacts/api-server/src/services/newsHub/deepDive.test.ts artifacts/api-server/src/services/newsHub/types.ts artifacts/api-server/src/routes/news.ts artifacts/trader-dashboard/src/lib/newsApi.ts artifacts/trader-dashboard/src/pages/News.tsx artifacts/trader-dashboard/src/pages/News.deep-dive.static.test.ts
```

Expected: diff only contains the deep dive feature and no unrelated rewrites.

## Self-Review

- Spec coverage: Tasks cover backend generation, API exposure, frontend type, dialog UI, fallback behavior, and verification.
- Placeholder scan: The plan contains no deferred implementation markers.
- Type consistency: The backend uses `NewsDeepDive`; the frontend uses `ArticleDeepDive`; both expose `whatHappened`, `whyItMatters`, and `possibleImpact`.
