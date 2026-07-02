# Performance Lightening ("veloce e scattante") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Cut the eager JavaScript payload roughly in half (573 kB → ~290 kB gzip), remove render-blocking font loading, stop the idle polling storm, and shrink multi-megabyte images — so the app loads and feels fast, especially on mobile.

**Architecture:** The app is a Vite/React SPA served by the Express API server on Railway. All routes are already `React.lazy`, but a `manualChunks` override forces every node_modules library into one eager 1.34 MB `vendor` chunk, and the 456 kB five-language i18n dictionary ships eagerly in the `index` chunk. The plan (1) restores Rollup's default per-route chunking, (2) splits the dictionary per language behind a dynamic import, (3) defers recharts out of the Dashboard chunk, (4) normalizes React Query polling intervals, (5) compresses oversized images, (6) enables Tailwind's optimizer and drops dead deps, and (7) merges the already-built `feat/scalability-hardening` backend work (DB index, journal N+1 fix, social WebSocket hub).

**Tech Stack:** Vite 7, Rollup, React 19, TanStack React Query, Tailwind 4 (`@tailwindcss/vite`), Express 5, sharp (one-off image script).

## Measured baseline (2026-07-02, production build)

| Asset | Size | Gzip | Eager? |
|---|---|---|---|
| `vendor-*.js` (manualChunks mega-chunk) | 1,336.91 kB | 400.29 kB | yes |
| `index-*.js` (app shell; **534 kB of it is i18n strings**) | 654.72 kB | 172.47 kB | yes |
| `index-*.css` | 310.05 kB | 38.87 kB | yes |
| `vendor-lightweight-charts-*.js` | 163.84 kB | 53.53 kB | lazy |
| **Eager JS total** | **1,991.63 kB** | **572.76 kB** | |

## Final results (2026-07-03)

Gate: `pnpm verify` — **292/292 tests pass**, build + prerender green.

### Before / After — eager payload

| Asset | Baseline | Final | Delta |
|---|---|---|---|
| Eager JS (`index-*.js`) | 1,991.63 kB / 572.76 kB gz | **923.27 kB / 283.28 kB gz** | **−53.7% min / −50.5% gz** |
| CSS (`index-*.css`) | 310.05 kB / 38.87 kB gz | 281.1 kB / 36.76 kB gz | −9.3% min / −5.4% gz |
| `public/` images | ~10 MB | **3.3 MB** | −67% |
| Dashboard idle req/min | ~25 | ~4 | −84% |

### Key lazy chunks (not in eager bundle)

| Chunk | Size | Gzip |
|---|---|---|
| `CotWidget-*.js` (recharts) | 389.94 kB | 106.50 kB |
| `Backtest-*.js` | 248.02 kB | 76.16 kB |
| `Library-*.js` | 184.55 kB | 59.20 kB |
| `Settings-*.js` | 129.26 kB | 33.64 kB |
| `Chat-*.js` | 123.70 kB | 28.64 kB |
| `Dashboard-*.js` | 114.26 kB | 35.62 kB |
| `dict.fr-*.js` | 103.87 kB | 32.35 kB |
| `dict.de-*.js` | 102.00 kB | 32.60 kB |
| `dict.es-*.js` | 101.50 kB | 31.76 kB |
| `dict.en-*.js` | 96.50 kB | 30.05 kB |

### Per-task commit log

| Task | What shipped | Commit |
|---|---|---|
| T1 | Drop `manualChunks` vendor mega-chunk → default Rollup per-route chunking | `6b81253` |
| T2 | Google Fonts via `<head>` preconnect instead of CSS `@import` | `c11de42` |
| T3 | CotWidget lazy → recharts out of Dashboard chunk (501→114 kB) | `cc29c8e` |
| T4 | Poll retune: quote 8s→1h, unread 5s→30s, profile/journal 10s→60s, Journal 10s→30s | `c83e6dd` |
| T5 | i18n dict split per language, lazily loaded; Italian eager fallback; dict.en/es/fr/de ~30 kB gz each | `9e630af` |
| T6 | 3 PNGs 1 MB+ → WebP (12–42 kB), backgrounds recompressed; `public/images` 9.9→3.0 MB | `1edde31` |
| T7 | Tailwind optimizer enabled (CSS 310→281 kB), embla-carousel + react-icons removed, carousel.tsx deleted | `e31fd6a` |
| T8 | Merged `feat/scalability-hardening` (DB index, journal N+1 fix, social WS hub, bounded caches, Stripe idempotency; migrations 0019/0020) + chat polls relaxed 3s→15s / 5s→10s, DMs 3s→8s / 5s→15s | `3c9d34f` + `0674887` |
| T9 | Final measure + docs (this section) | TBD |

### Browser verification checklist (→ user)

The following steps require a running browser session and are deliberately left for manual confirmation:

- [ ] Sign in → visit `/`, `/journal`, `/backtest`, `/library`, `/chat` — no black screen, no `forwardRef` console errors
- [ ] Switch language IT→EN→DE in Settings — copy changes within ~200 ms, no raw key strings visible
- [ ] Dashboard with COT widget enabled — skeleton flashes briefly, then the chart renders
- [ ] Two browser sessions open in community chat — message sent from one appears in the other via WebSocket within ~1 s (not after 15 s)

Measured experiment (build with `manualChunks` removed, nothing else changed): eager JS drops to **1,325.84 kB / 379.98 kB gzip** (−34%); recharts moves into the Dashboard chunk (501 kB), @xyflow+d3-force into Library (184 kB), lightweight-charts into Backtest (248 kB).

Other verified findings:

- `src/lib/i18n.ts` is 7,547 lines / 456 kB; all 5 languages are eagerly bundled. Only `contexts/LanguageContext.tsx` imports `DICT` in app code; `TranslationKey` has zero importers. 4 test files import `DICT`.
- Google Fonts loads via `@import` on line 2 of `src/index.css` → render-blocking serial chain (CSS → font CSS → font files).
- Polling storm: quote-of-the-day refetched **every 8s** in two widgets, unread badge 5s, profile/journal widgets 10s, community chat 3s, voice presence 5s. Dashboard idle ≈ 25 requests/min.
- `public/images/`: `journal-empty.png` 1.2 MB, `dashboard-bg.png` 1.0 MB, `avatar-default.png` 1.0 MB, several 500 kB–1 MB background webps. `public/` totals 10 MB.
- `tailwindcss({ optimize: false })` in vite.config.ts — CSS optimizer disabled, no comment explaining why.
- Dead deps: `react-icons` and `embla-carousel-react` have **zero importers**; `src/components/ui/chart.tsx` (recharts wrapper) and `src/components/ui/carousel.tsx` have zero importers.
- Server-side is already good: `compression` on, hashed assets `immutable, max-age=1y`, `index.html`/`sw.js` `no-store`. The remaining backend wins live on the un-merged `feat/scalability-hardening` branch (15 commits: `account_trades` index, journal N+1 kill, pool raise, social WS hub, bounded caches).

## Global Constraints

- **pnpm only**; toolchain needs `export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"`.
- Production build needs `VITE_CLERK_PUBLISHABLE_KEY`; source it with `export $(grep VITE_CLERK_PUBLISHABLE_KEY /Users/gazz/Desktop/TraderLoadingsLOCALE/.env.local)`.
- **Multi-agent shared working tree**: ALWAYS commit with an explicit pathspec (`git commit -m "…" -- <paths>`), never `git add -A`/`git commit -a`. Before touching `src/lib/i18n.ts` (Task 5) check `git status`/`git diff --cached -- artifacts/trader-dashboard/src/lib/i18n.ts` for other agents' staged WIP and coordinate if dirty.
- `@typescript-eslint/no-explicit-any` = error in non-test source. Don't `prettier --write` api-server files.
- All user-visible copy must go through `t()` with keys in all 5 languages (`production-copy.static.test.ts` enforces this). No mojibake chars Ã/â/Â/ð in dict values (`i18n.parity.static.test.ts`).
- The gate before declaring any task done: `pnpm verify` from the repo root (or at minimum `pnpm typecheck` + the dashboard static tests + a production build for frontend-only tasks).
- After each completed task: commit (pathspec) and `git push` the current branch (`feat/community-management`).
- Do NOT merge anything to `main`.

---

### Task 1: Restore Rollup default chunking (biggest single win, already measured)

**Files:**
- Modify: `artifacts/trader-dashboard/vite.config.ts` (the `build.rollupOptions` block, ~lines 79–99)

**Interfaces:**
- Produces: per-route lazy chunks; later tasks measure against this task's build output.

**Why it's safe:** the historical "black screen" (`forwardRef` of undefined) came from *manually grouping* React-consuming libs into separate named chunks, which created circular chunk graphs. Rollup's *default* chunking is topologically ordered and cannot produce that cycle. Verification below still proves it in a real browser: the `prerender` build step drives headless Chromium over the landing/SEO pages and fails on a blank render.

- [x] **Step 1: Remove the manualChunks override**

In `artifacts/trader-dashboard/vite.config.ts`, replace:

```ts
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // lightweight-charts is framework-agnostic (canvas) and large → safe to isolate.
          if (id.includes("lightweight-charts")) return "vendor-lightweight-charts";
          // @dnd-kit is used ONLY by the (lazy) Dashboard page and is a leaf that just
          // consumes React (one-way edge → vendor, no cycle), so it can live in its own
          // chunk that loads with Dashboard instead of bloating the eager vendor chunk.
          if (id.includes("@dnd-kit")) return "vendor-dnd";
          // Everything else — React itself AND every library that touches React APIs
          // (forwardRef/hooks) at module-init time (@radix-ui, lucide-react, recharts,
          // framer-motion, @dnd-kit, @clerk, wouter), plus React's CommonJS-interop
          // helper modules — MUST live in one chunk. Splitting them across vendor-ui /
          // vendor-react / vendor-recharts produced CIRCULAR chunk graphs
          // (vendor-ui ↔ vendor-react), so a UI chunk evaluated before React was ready
          // → "Cannot read properties of undefined (reading 'forwardRef')" → black screen.
          return "vendor";
        },
      },
    },
  },
```

with:

```ts
    reportCompressedSize: true,
    // No manualChunks: Rollup's default per-dynamic-import chunking is
    // topologically ordered (no circular chunk graphs), so page-only libraries
    // (recharts, @xyflow, lightweight-charts, @dnd-kit) load with their lazy
    // page instead of in an eager vendor mega-chunk. The old manual grouping
    // that black-screened (forwardRef undefined) is exactly what this avoids.
  },
```

- [x] **Step 2: Full production build (includes prerender = headless-browser smoke test)**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
export $(grep VITE_CLERK_PUBLISHABLE_KEY /Users/gazz/Desktop/TraderLoadingsLOCALE/.env.local)
cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard
pnpm build 2>&1 | tail -40
```

Expected: build succeeds; prerender step completes (it fails loudly on a blank page). Eager entry (`index-*.js` + its statically-imported chunk) ≈ **1,326 kB / 380 kB gzip** total; `Dashboard-*.js` ≈ 501 kB (recharts — fixed in Task 3), `Library-*.js` ≈ 185 kB, `Backtest-*.js` ≈ 248 kB.

- [ ] **Step 3: Manual signed-in smoke test (prerender only covers anonymous pages)**

```bash
pnpm serve   # vite preview on :5173
```

In the browser: sign in, visit `/` (Dashboard), `/journal`, `/backtest`, `/library`, `/chat`. Expected: no black screen, no console error `Cannot read properties of undefined (reading 'forwardRef')`.

- [x] **Step 4: Run the dashboard static tests**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm test 2>&1 | tail -10
```

Expected: PASS (same pass/fail set as before the change; 2 pre-existing base-main failures — railwayDeploy/Dashboard.order — are known and not caused here).

- [x] **Step 5: Commit + push**

```bash
git commit -m "perf(ui): drop the manual vendor mega-chunk, let Rollup split per route

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- artifacts/trader-dashboard/vite.config.ts
git push
```

---

### Task 2: Un-block font loading (remove CSS `@import` of Google Fonts)

**Files:**
- Modify: `artifacts/trader-dashboard/src/index.css` (line 2)
- Modify: `artifacts/trader-dashboard/index.html` (`<head>`)

- [x] **Step 1: Delete the `@import` from index.css**

Remove line 2 of `src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@400;500;600;700&display=swap');
```

(keep `@import "tailwindcss";` and everything else unchanged).

- [x] **Step 2: Add preconnect + stylesheet link to index.html**

In `index.html`, immediately after the `<meta name="viewport" …>` tag, add:

```html
    <!-- Fonts: loaded from <head> with preconnect instead of a render-blocking
         CSS @import chain (CSS → font CSS → font files). display=swap keeps
         text visible while fonts load. -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@400;500;600;700&display=swap" />
```

- [x] **Step 3: Build and verify the link landed in dist**

```bash
pnpm build 2>&1 | tail -5
grep -c "fonts.googleapis.com/css2" dist/public/index.html
```

Expected: build OK; grep prints `1`.

- [ ] **Step 4: Visual check**

`pnpm serve`, open the landing page: Fira Sans/Fira Code render (inspect any heading's computed font-family). Expected: fonts unchanged visually.

- [x] **Step 5: Commit + push**

```bash
git commit -m "perf(ui): load Google Fonts from <head> with preconnect, not CSS @import

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- artifacts/trader-dashboard/src/index.css artifacts/trader-dashboard/index.html
git push
```

---

### Task 3: Lazy-load CotWidget so recharts leaves the Dashboard chunk

After Task 1, recharts (~420 kB min) lands in `Dashboard-*.js` because `CotWidget` is its only importer. Lazy-loading the widget moves recharts into its own chunk fetched only when the COT widget is actually rendered.

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx` (import at ~line 38 and, if the registry references `CotWidget` directly, the `WIDGET_DEFS` entry)

**Interfaces:**
- Consumes: `CotWidget` is exported as a **named export** from `@/components/CotWidget`.
- Produces: `WIDGET_DEFS` keeps the same `component: ComponentType` shape — `React.lazy` returns a component type, so the registry and grid code need no other change.

- [x] **Step 1: Swap the static import for React.lazy + Suspense**

In `pages/Dashboard.tsx` replace:

```tsx
import { CotWidget } from "@/components/CotWidget";
```

with (place next to the other imports; `lazy`/`Suspense` may already be imported from react — extend the existing import if so):

```tsx
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// recharts (~420 kB min) is used only by CotWidget; lazy-loading keeps it out
// of the Dashboard route chunk.
const CotWidgetInner = lazy(() =>
  import("@/components/CotWidget").then((m) => ({ default: m.CotWidget })),
);

function CotWidget() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <CotWidgetInner />
    </Suspense>
  );
}
```

The `WIDGET_DEFS` entry (`{ id: "cot", … component: CotWidget }`) stays untouched because the local `CotWidget` wrapper has the same name and signature.

- [x] **Step 2: Typecheck + build, verify the chunk split**

```bash
pnpm typecheck && pnpm build 2>&1 | grep -E "Dashboard-|CotWidget-" 
```

Expected: `Dashboard-*.js` shrinks from ~501 kB to well under 150 kB; a new lazy chunk (containing recharts) appears.

- [ ] **Step 3: Manual check**

`pnpm serve`, sign in, open Dashboard with the COT widget enabled. Expected: skeleton flashes briefly, then the COT chart renders as before.

- [x] **Step 4: Commit + push**

```bash
git commit -m "perf(ui): lazy-load CotWidget so recharts leaves the Dashboard chunk

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- artifacts/trader-dashboard/src/pages/Dashboard.tsx
git push
```

---

### Task 4: Normalize widget polling intervals (network + main-thread quiet)

A motivational quote does not change every 8 seconds. These are pure interval/staleTime retunes — no behavior change besides refresh cadence. (Community-chat/voice intervals are handled in Task 8 after the WebSocket merge; do NOT touch `social/hooks.ts` or `MessaggiTab.tsx` here.)

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/QuoteWidget.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ClockWidget.tsx`
- Modify: `artifacts/trader-dashboard/src/components/BottomNav.tsx` (~line 213)
- Modify: `artifacts/trader-dashboard/src/components/ProfileWidget.tsx`
- Modify: `artifacts/trader-dashboard/src/components/JournalWidget.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Journal.tsx` (two occurrences)

- [x] **Step 1: Retune the intervals**

| File | Query | From | To |
|---|---|---|---|
| `QuoteWidget.tsx` | `useGetRandomQuote` | `refetchInterval: 8000` | `refetchInterval: 60 * 60_000, staleTime: 60 * 60_000` |
| `ClockWidget.tsx` | `useGetRandomQuote` (~line 34) | `refetchInterval: 8000` | `refetchInterval: 60 * 60_000, staleTime: 60 * 60_000` |
| `BottomNav.tsx` | `useGetUnreadCount` | `refetchInterval: 5000` | `refetchInterval: 30_000` |
| `ProfileWidget.tsx` | profile/xp query | `refetchInterval: 10_000` | `refetchInterval: 60_000` |
| `JournalWidget.tsx` | journal query | `refetchInterval: 10_000` | `refetchInterval: 60_000` |
| `pages/Journal.tsx` | both queries | `refetchInterval: 10_000` | `refetchInterval: 30_000` |

Example edit shape (QuoteWidget):

```tsx
const { data: quote } = useGetRandomQuote({
  query: {
    queryKey: getGetRandomQuoteQueryKey(),
    // A daily quote — refresh hourly, not every 8s.
    refetchInterval: 60 * 60_000,
    staleTime: 60 * 60_000,
  },
});
```

Note: the ClockWidget's clock itself ticks via local `setInterval`/state — only its quote query changes.

- [x] **Step 2: Verify no interval below 30s remains outside social/**

```bash
cd artifacts/trader-dashboard/src
grep -rn "refetchInterval" --include="*.tsx" --include="*.ts" . | grep -v test | grep -v "social/" | grep -v "MessaggiTab" | grep -E ": [0-9]{3,4}[,}]|: [12]?[0-9]_000"
```

Expected: no matches except `pages/Wiki.tsx` / `pages/BillingReturn.tsx` (conditional function intervals — polls only while an extraction/checkout is in flight, correct as-is) and `ClockWidget`'s local clock tick if it shows up.

- [x] **Step 3: Typecheck + tests**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm typecheck && pnpm test 2>&1 | tail -5
```

Expected: PASS (known 2 pre-existing failures aside).

- [x] **Step 4: Commit + push**

```bash
git commit -m "perf(ui): retune widget polling (quote 8s→1h, unread 5s→30s, profile/journal 10s→60s)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- artifacts/trader-dashboard/src/components/QuoteWidget.tsx artifacts/trader-dashboard/src/components/ClockWidget.tsx artifacts/trader-dashboard/src/components/BottomNav.tsx artifacts/trader-dashboard/src/components/ProfileWidget.tsx artifacts/trader-dashboard/src/components/JournalWidget.tsx artifacts/trader-dashboard/src/pages/Journal.tsx
git push
```

---

### Task 5: Split the i18n dictionary per language (−~100 kB gzip eager)

⚠️ **Coordination gate:** `src/lib/i18n.ts` is the multi-agent hotspot (see Global Constraints). Run `git status --short artifacts/trader-dashboard/src/lib/` first; if another agent has uncommitted changes there, STOP and coordinate with the user before proceeding.

**Design:** a one-off generator evaluates the current runtime-merged `DICT` and emits five per-language files, which become the new source of truth. `i18n.ts` keeps all helpers/types, statically imports only the Italian dictionary (default language + `t()` fallback), and exposes an async `loadDict()`. `LanguageContext` swaps dictionaries asynchronously (non-Italian users see Italian for one network round-trip on cold load — the per-language chunk is ~30 kB gzip). Tests that need all languages import a new test/tool-only aggregate `i18n/all.ts` (never imported by app code, so it never enters the eager graph).

**Files:**
- Create (temporary): `artifacts/trader-dashboard/scripts/generate-i18n-dicts.ts` (deleted in Step 8)
- Create (generated): `artifacts/trader-dashboard/src/lib/i18n/dict.{it,en,es,fr,de}.ts`
- Create: `artifacts/trader-dashboard/src/lib/i18n/all.ts`
- Rewrite: `artifacts/trader-dashboard/src/lib/i18n.ts`
- Delete: `artifacts/trader-dashboard/src/lib/i18n.tornei.ts`, `artifacts/trader-dashboard/src/lib/i18n.reviews.ts` (their content is folded into the generated files)
- Modify: `artifacts/trader-dashboard/src/contexts/LanguageContext.tsx`
- Modify (imports only): `src/production-copy.static.test.ts`, `src/components/AppTutorial.static.test.ts`, `src/lib/i18n.parity.static.test.ts`, `src/lib/i18n.locale.test.ts`

**Interfaces:**
- Produces: `loadDict(lang: Language): Promise<Record<string, string>>`, `FALLBACK_DICT: Record<string, string>` (Italian), `DICT` re-export in `i18n/all.ts` with the exact old shape `Record<Language, Record<string, string>>` for tests.
- Unchanged exports of `i18n.ts`: `Language`, `SUPPORTED_LANGUAGES`, `normalizeLocaleToLanguage`, `detectLanguageFromLocales`, `TranslationKey`.

- [x] **Step 1: Write the one-off generator**

Create `artifacts/trader-dashboard/scripts/generate-i18n-dicts.ts`:

```ts
// One-off migration: evaluate the runtime-merged DICT from the monolithic
// i18n.ts and emit one dictionary module per language. Run once with tsx,
// then this script is deleted together with the monolith's data blocks.
import fs from "node:fs";
import path from "node:path";
import { DICT, SUPPORTED_LANGUAGES } from "../src/lib/i18n";

const outDir = path.resolve(import.meta.dirname, "../src/lib/i18n");
fs.mkdirSync(outDir, { recursive: true });

for (const lang of SUPPORTED_LANGUAGES) {
  const entries = Object.entries(DICT[lang]).sort(([a], [b]) => a.localeCompare(b));
  const body = entries
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");
  const src = `// "${lang}" UI dictionary — source of truth (was merged inside the monolithic i18n.ts).\n// Loaded lazily via loadDict(); only dict.it.ts is in the eager bundle (fallback language).\nconst dict: Record<string, string> = {\n${body}\n};\n\nexport default dict;\n`;
  fs.writeFileSync(path.join(outDir, `dict.${lang}.ts`), src);
  console.log(`dict.${lang}.ts: ${entries.length} keys`);
}
```

- [x] **Step 2: Run it and sanity-check the output**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard
npx tsx scripts/generate-i18n-dicts.ts
ls -la src/lib/i18n/ && head -5 src/lib/i18n/dict.en.ts
```

Expected: five files, each reporting the **same key count** (parity already enforced by tests). If counts differ across languages, STOP — investigate before continuing.

- [x] **Step 3: Rewrite `src/lib/i18n.ts`**

Replace the whole file with (this keeps every export the app/tests use; all dictionary data now lives in `i18n/dict.*.ts`):

```ts
import DICT_IT from "./i18n/dict.it";

export type Language = "it" | "en" | "es" | "fr" | "de";

export const SUPPORTED_LANGUAGES = ["it", "en", "es", "fr", "de"] as const;

export function normalizeLocaleToLanguage(locale: string | null | undefined): Language | null {
  if (!locale) return null;
  const base = locale.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base) ? (base as Language) : null;
}

export function detectLanguageFromLocales(
  locales: readonly (string | null | undefined)[],
): Language | null {
  for (const locale of locales) {
    const language = normalizeLocaleToLanguage(locale);
    if (language) return language;
  }
  return null;
}

/** Italian dictionary — default language and the `t()` fallback; the only one in the eager bundle. */
export const FALLBACK_DICT: Record<string, string> = DICT_IT;

export type TranslationKey = keyof typeof DICT_IT;

const DICT_LOADERS: Record<Language, () => Promise<{ default: Record<string, string> }>> = {
  it: () => Promise.resolve({ default: DICT_IT }),
  en: () => import("./i18n/dict.en"),
  es: () => import("./i18n/dict.es"),
  fr: () => import("./i18n/dict.fr"),
  de: () => import("./i18n/dict.de"),
};

/** Load a language's dictionary; non-Italian languages arrive as lazy chunks. */
export async function loadDict(lang: Language): Promise<Record<string, string>> {
  return (await DICT_LOADERS[lang]()).default;
}
```

**Before replacing**, copy the *exact* current bodies of `normalizeLocaleToLanguage`/`detectLanguageFromLocales` from the existing file (lines 8–23) — `i18n.locale.test.ts` pins their behavior; the versions above are from memory of that file and the real ones win.

- [x] **Step 4: Create the test/tool aggregate `src/lib/i18n/all.ts`**

```ts
// Aggregate of every language dictionary in the legacy `DICT` shape.
// FOR TESTS AND BUILD TOOLS ONLY — importing this from app code would put all
// five languages back into the eager bundle (the exact problem loadDict solves).
import type { Language } from "../i18n";
import it from "./dict.it";
import en from "./dict.en";
import es from "./dict.es";
import fr from "./dict.fr";
import de from "./dict.de";

export const DICT: Record<Language, Record<string, string>> = { it, en, es, fr, de };
```

- [x] **Step 5: Rewire `LanguageContext.tsx` to async dictionaries**

In `src/contexts/LanguageContext.tsx`, change the import and the provider:

```tsx
import { detectLanguageFromLocales, FALLBACK_DICT, loadDict, type Language } from "@/lib/i18n";
```

Inside `LanguageProvider`, replace the direct `DICT` usage:

```tsx
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLangState] = useState<Language>(getInitialLanguage);
  // Italian is bundled eagerly (fallback); other languages swap in as soon as
  // their lazy chunk arrives (~30 kB gzip — one round-trip on cold load).
  const [dict, setDict] = useState<Record<string, string>>(FALLBACK_DICT);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let alive = true;
    loadDict(language).then((d) => {
      if (alive) setDict(d);
    });
    return () => {
      alive = false;
    };
  }, [language]);

  const setLanguage = (lang: Language, persist = true) => {
    if (persist) localStorage.setItem(STORAGE_KEY, lang);
    setLangState(lang);
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let str = dict[key] ?? FALLBACK_DICT[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replaceAll(`{${k}}`, String(v));
      });
    }
    return str;
  };
  // …rest of the provider unchanged
```

- [x] **Step 6: Update the four test imports**

In `src/production-copy.static.test.ts`, `src/components/AppTutorial.static.test.ts`, `src/lib/i18n.parity.static.test.ts`, `src/lib/i18n.locale.test.ts`: change

```ts
import { DICT } from "…/lib/i18n";        // old (path varies per file)
```

to

```ts
import { DICT } from "…/lib/i18n/all";    // same relative prefix as the old import
```

(`i18n.locale.test.ts` mostly tests the locale helpers — only touch its `DICT` import if it has one.) If any test greps the *file* `i18n.ts` by path rather than importing (check with `grep -rn "i18n.ts" src/*.test.ts src/**/*.test.ts`), point it at `src/lib/i18n/` instead so it scans the generated dictionaries.

- [x] **Step 7: Delete the folded-in satellite dictionaries**

```bash
git rm artifacts/trader-dashboard/src/lib/i18n.tornei.ts artifacts/trader-dashboard/src/lib/i18n.reviews.ts
grep -rln "i18n.tornei\|i18n.reviews" artifacts/trader-dashboard/src --include="*.ts*"
```

Expected: grep returns nothing (their only importer was the old i18n.ts).

- [x] **Step 8: Delete the generator, run the full gate**

```bash
rm artifacts/trader-dashboard/scripts/generate-i18n-dicts.ts
cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm typecheck && pnpm test 2>&1 | tail -10
cd artifacts/trader-dashboard && pnpm build 2>&1 | tail -30
```

Expected: typecheck PASS; parity/mojibake/production-copy tests PASS (same data, new home); build shows `dict.en/es/fr/de` as **lazy** chunks (~110 kB each) and the eager entry drops by ~400 kB min / ~85–100 kB gzip vs Task 1's numbers.

- [ ] **Step 9: Manual language-switch check**

`pnpm serve`, sign in, switch language IT→EN→DE in Settings. Expected: copy switches correctly after at most a brief (<200 ms) delay on first switch; no missing-key strings (raw `xxx.yyy` keys) anywhere.

- [x] **Step 10: Commit + push**

```bash
git add artifacts/trader-dashboard/src/lib/i18n/ 
git commit -m "perf(ui): split i18n dictionary per language, load lazily (eager bundle −~400 kB)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- artifacts/trader-dashboard/src/lib/i18n.ts artifacts/trader-dashboard/src/lib/i18n/ artifacts/trader-dashboard/src/lib/i18n.tornei.ts artifacts/trader-dashboard/src/lib/i18n.reviews.ts artifacts/trader-dashboard/src/contexts/LanguageContext.tsx artifacts/trader-dashboard/src/production-copy.static.test.ts artifacts/trader-dashboard/src/components/AppTutorial.static.test.ts artifacts/trader-dashboard/src/lib/i18n.parity.static.test.ts artifacts/trader-dashboard/src/lib/i18n.locale.test.ts
git push
```

---

### Task 6: Compress the multi-megabyte images

**Files:**
- Create (temporary): `artifacts/trader-dashboard/scripts/compress-images.ts` (deleted at the end)
- Modify: `artifacts/trader-dashboard/public/images/*` (recompressed in place / converted)
- Modify: whatever source files reference the three converted PNGs (found by grep in Step 3)

- [x] **Step 1: Add sharp to the dashboard devDependencies and write the script**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard
pnpm add -D sharp
```

Create `scripts/compress-images.ts`:

```ts
// One-off: convert the three oversized PNGs to sized WebP and recompress any
// background WebP above 400 kB in place. Delete this script after running.
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";

const IMAGES = path.resolve(import.meta.dirname, "../public/images");

// PNG → WebP with a max width (none of these render above ~1280 CSS px).
const CONVERT: Array<{ file: string; width: number; quality: number }> = [
  { file: "journal-empty.png", width: 1280, quality: 78 },
  { file: "dashboard-bg.png", width: 1600, quality: 75 },
  { file: "avatar-default.png", width: 512, quality: 80 },
];

for (const { file, width, quality } of CONVERT) {
  const src = path.join(IMAGES, file);
  const out = src.replace(/\.png$/, ".webp");
  await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(out);
  console.log(`${file} → ${path.basename(out)}: ${(fs.statSync(out).size / 1024).toFixed(0)} kB`);
}

// Recompress heavy selectable backgrounds in place (target ≤ ~350 kB).
for (const dir of ["backgrounds/desktop", "backgrounds/mobile"]) {
  const full = path.join(IMAGES, dir);
  for (const f of fs.readdirSync(full).filter((f) => f.endsWith(".webp"))) {
    const p = path.join(full, f);
    if (fs.statSync(p).size < 400 * 1024) continue;
    const buf = await sharp(p).webp({ quality: 72 }).toBuffer();
    if (buf.length < fs.statSync(p).size) {
      fs.writeFileSync(p, buf);
      console.log(`${dir}/${f}: → ${(buf.length / 1024).toFixed(0)} kB`);
    }
  }
}
```

- [x] **Step 2: Run it**

```bash
npx tsx scripts/compress-images.ts
du -sh public/images
find public -size +400k -exec du -h {} \;
```

Expected: the three `.webp` outputs ≤ ~150 kB each; no image above ~400 kB left; `public/` well under 5 MB.

- [x] **Step 3: Repoint code references from .png to .webp and delete the old PNGs**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard
grep -rn "journal-empty.png\|dashboard-bg.png\|avatar-default.png" src public --include="*.ts*" --include="*.css" --include="*.html"
```

Edit every hit to the `.webp` filename, then:

```bash
git rm public/images/journal-empty.png public/images/dashboard-bg.png public/images/avatar-default.png
```

⚠️ Before deleting `avatar-default.png`, also grep the **api-server** (`grep -rn "avatar-default" ../api-server/src`) — if the backend serves that URL as a default avatar value stored in the DB, keep the PNG as well and only swap the frontend references (note the finding in the commit message).

- [x] **Step 4: Remove sharp + the script, verify, commit**

```bash
pnpm remove sharp && rm scripts/compress-images.ts
cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm typecheck && cd artifacts/trader-dashboard && pnpm build 2>&1 | tail -5
```

Visual check via `pnpm serve`: journal empty-state, dashboard background, default avatar, and the Zen/background picker all render crisply.

```bash
git add artifacts/trader-dashboard/public/images artifacts/trader-dashboard/package.json
git commit -m "perf(assets): convert 1 MB+ PNGs to sized WebP, recompress heavy backgrounds

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- artifacts/trader-dashboard/public/images artifacts/trader-dashboard/package.json artifacts/trader-dashboard/pnpm-lock.yaml <files-edited-in-step-3>
git push
```

(Replace `<files-edited-in-step-3>` with the actual source files repointed to .webp. `pnpm-lock.yaml` is at the repo root — adjust the path if `pnpm add/remove` changed the root lockfile: `pnpm-lock.yaml`.)

---

### Task 7: Enable the Tailwind optimizer + drop dead dependencies

**Files:**
- Modify: `artifacts/trader-dashboard/vite.config.ts` (the `tailwindcss({ optimize: false })` plugin line)
- Modify: `artifacts/trader-dashboard/package.json` (remove `react-icons`, `embla-carousel-react`)
- Delete: `artifacts/trader-dashboard/src/components/ui/chart.tsx`, `artifacts/trader-dashboard/src/components/ui/carousel.tsx`

All four removals were verified to have **zero importers** on 2026-07-02 — re-verify in Step 2 in case another agent added one since.

- [x] **Step 1: Enable the CSS optimizer**

In `vite.config.ts` change:

```ts
    tailwindcss({ optimize: false }),
```

to:

```ts
    tailwindcss(),
```

- [x] **Step 2: Re-verify the dead code is still dead, then remove it**

```bash
cd artifacts/trader-dashboard/src
grep -rln "react-icons\|embla-carousel\|ui/carousel\|ui/chart" . --include="*.ts*" | grep -v "ui/carousel.tsx" | grep -v "ui/chart.tsx"
```

Expected: no output. If a file shows up, leave that dependency alone and only remove the truly-unused ones. Then:

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard
git rm src/components/ui/chart.tsx src/components/ui/carousel.tsx
pnpm remove react-icons embla-carousel-react
```

- [x] **Step 3: Full gate + visual spot-check**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm verify 2>&1 | tail -15
```

Expected: green (modulo the 2 known pre-existing failures). Compare the built `index-*.css` size against Task 1's 310 kB — record the delta. `pnpm serve` → open `/styleguide` and the Dashboard: glass materials, tokens, and shadows render identically (the design-* static tests also guard this).

**Rollback note:** if `/styleguide` or any page renders visibly wrong with the optimizer on, revert the vite.config.ts line to `tailwindcss({ optimize: false })` with an explanatory comment, keep the dead-dep removals, and note the incompatibility in the commit message.

- [x] **Step 4: Commit + push**

```bash
git commit -m "perf(ui): enable Tailwind CSS optimizer, drop unused react-icons/embla + dead ui wrappers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- artifacts/trader-dashboard/vite.config.ts artifacts/trader-dashboard/package.json artifacts/trader-dashboard/src/components/ui/chart.tsx artifacts/trader-dashboard/src/components/ui/carousel.tsx pnpm-lock.yaml
git push
```

---

### Task 8: Merge `feat/scalability-hardening` + relax the community-chat poll

⚠️ **Coordination gate:** this merges 15 backend/UI commits into the shared multi-agent branch. Get the user's go-ahead first (the branch diverged: community-management has 45 commits the hardening branch lacks — expect conflicts in `social/hooks.ts` and possibly `i18n` if Task 5 already ran).

What it brings (all built and tested on that branch): `account_trades(user_id,status)` index + journal N+1 fix + pool raise (`7f69138`), social real-time WebSocket hub (`fe26e26`, `d5153fb` — client wired, polling retained as fallback), bounded push-dedup caches, LLM call timeout, Stripe webhook idempotency, WS connection cap, client Sentry.

- [x] **Step 1: Merge**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE
git status --short   # must be clean of OTHER agents' WIP before merging
git merge feat/scalability-hardening
```

Resolve conflicts favoring: current branch for UI copy/i18n; hardening branch for `services/`, `routes/`, WS code. After resolving:

```bash
pnpm verify 2>&1 | tail -15
git push
```

- [x] **Step 2: Relax the community-chat and voice-presence polls (WS now carries real-time)**

In `src/components/social/hooks.ts`: `refetchInterval: 3_000` → `refetchInterval: 15_000` (channel messages — WS delivers new ones instantly; the poll is only a reconnection safety net) and `refetchInterval: 5_000` → `refetchInterval: 10_000` (voice presence). In `src/components/social/MessaggiTab.tsx` (DMs — **not** covered by the WS hub): `refetchInterval: 3000` → `refetchInterval: 8000` and `refetchInterval: 5000` → `refetchInterval: 15000`.

- [ ] **Step 3: Browser-verify chat liveness (required — this was explicitly deferred pending browser verification)**

Run the app locally (`./dev-up.sh`), open two browser sessions in the community chat: a message sent from one appears in the other **via WebSocket within ~1 s** (not after 15 s). DMs in MessaggiTab update within 8 s. If WS delivery does not work, revert Step 2's `hooks.ts` change (keep the MessaggiTab retune) and investigate before re-applying.

- [x] **Step 4: Commit + push**

```bash
git commit -m "perf(chat): relax polling now that the social WebSocket hub carries real-time

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- artifacts/trader-dashboard/src/components/social/hooks.ts artifacts/trader-dashboard/src/components/social/MessaggiTab.tsx
git push
```

---

### Task 9: Final measurement + docs

**Files:**
- Modify: `CLAUDE.md` (§7 Active work)
- Modify: this plan (check off tasks, record final numbers)

- [x] **Step 1: Full gate + final build measurement**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm verify 2>&1 | tail -15
cd artifacts/trader-dashboard && pnpm build 2>&1 | tail -40
```

Record in this plan file, next to the baseline table: eager JS total (expect ≈ **900 kB min / ~290 kB gzip**, −50% vs 1,992/573), Dashboard chunk, CSS size, `public/` size (expect < 5 MB), Dashboard idle request rate (expect ≈ 4/min vs 25/min).

- [x] **Step 2: Update CLAUDE.md §7 and the memory index**

Add one line to §7 noting the performance-lightening pass (link this plan) and whether Task 8's merge happened; trim anything §7 lists as pending that this work completed.

- [x] **Step 3: Commit + push**

```bash
git commit -m "docs(plan): record performance-lightening results

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- docs/superpowers/plans/2026-07-02-performance-lightening.md CLAUDE.md
git push
```

---

## Explicitly out of scope (deliberate, don't drift into these)

- **framer-motion → LazyMotion**: ~25 kB gzip eager win but touches every `motion.` call site; revisit only if the final eager number disappoints.
- **List virtualization** (chat/journal long lists) and the **COT server-side shared cache**: tracked as the remaining items of the scalability-hardening effort; both need browser/load verification beyond this plan.
- **Self-hosting fonts**: Task 2's preconnect fixes the blocking chain; self-hosting is a marginal further win.
- **Service-worker asset precaching**: `sw.js` is push-only today; adding precache changes update semantics (`no-store` index.html) — separate design needed.
