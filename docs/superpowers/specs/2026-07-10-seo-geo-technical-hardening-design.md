# SEO/GEO Technical Hardening (Phase 1)

## Context

The app already has substantial SEO/GEO infrastructure: `robots.txt` with an
explicit allowlist for AI crawlers (GPTBot, ClaudeBot, PerplexityBot,
Google-Extended, ...), a multilingual auto-generated `sitemap.xml`, `llms.txt`,
per-route head-tag management (`src/components/Seo.tsx`) with JSON-LD/hreflang,
and a headless-Chromium prerendering pipeline (`scripts/prerender.ts`) that
snapshots the public marketing surface to static HTML so non-JS crawlers see
real content instead of an empty SPA shell. `docs/seo/keyword-strategy.md`
already documents the strategy and an honest off-site-authority caveat.

Investigating why the site isn't showing up for organic queries surfaced three
concrete, fixable gaps in this existing machinery (verified by hand, not
assumed):

1. **Prerendering is silently best-effort.** `puppeteer`/`sirv` are
   `optionalDependencies`; if they fail to install, or Chromium fails to
   launch, or a captured page happens to render an error state, the script
   logs a warning and exits `0` — the build "succeeds" while shipping broken
   or missing static snapshots to every crawler indefinitely, with no signal
   to anyone. Confirmed locally: a build without `VITE_CLERK_PUBLISHABLE_KEY`
   set (an old stale local artifact, not representative of a real Railway
   deploy, but proof the failure mode exists) produced a prerendered
   `about/index.html` containing only an "Authentication is not configured"
   error screen — and the script reported nothing wrong.
2. **An unnecessary redirect hop on every prerendered page.** Requesting
   `/about` (no trailing slash — the canonical form used everywhere: sitemap,
   canonical tags, internal links) causes `express.static`
   (`artifacts/api-server/src/app.ts`) to 301-redirect to `/about/` before the
   prerendered `index.html` is served. Confirmed by tracing `serve-static`
   through `send`'s directory/index resolution. Not a correctness bug — the
   content does arrive — but it's a wasted round-trip on every single
   marketing URL, and a canonical tag that points at a URL that itself
   redirects is not clean.
3. **`robots.txt` disallow list has drifted from the real route table.** The
   authenticated app gained `/wiki`, `/tornei`, `/support`, `/welcome`,
   `/styleguide` since the disallow list was last written; none of these are
   listed, so nothing currently prevents a crawler from attempting them (in
   practice they'd hit the signed-out landing-page fallback per `App.tsx`, so
   this is a low-severity drift, but worth closing).

Two things are explicitly **out of scope for this phase** because they are not
fixable by code:

- **Google Search Console / Bing Webmaster verification.** Confirmed nothing
  is wired up (no verification meta tag/file, no env var). Creating the
  account and verifying the domain is a user action (owns the Google/Bing
  account). This phase adds the mechanical support for it (any file dropped
  in `public/` is already served statically — no code change needed) and
  documents the exact steps.
- **GA4 measurement ID.** Code already exists and is a safe no-op without
  `VITE_GA_MEASUREMENT_ID` (`src/lib/analytics.ts`). Setting the real ID is a
  user action (owns the GA4 property). No code change in this phase.
- **Content depth / off-site authority** (backlinks, domain age, a real
  blog). This is Phase 2, a separate design, done one at a time as requested.

## Decisions (locked)

| Aspect | Decision |
|---|---|
| `puppeteer`/`sirv` | Move from `optionalDependencies` to `dependencies` in `artifacts/trader-dashboard/package.json` |
| Prerender failure mode | `scripts/prerender.ts` exits non-zero (fails the build) if Chromium can't launch, or if any captured page fails content validation |
| Content validation | A pure, unit-testable function `isValidSnapshot(html: string): boolean` — rejects a snapshot that contains the app's error-boundary marker (`role="alert"` fallback rendered by the top-level error boundary) or is missing an `<h1>` |
| Redirect elimination | Before falling into `express.static`'s normal handling, `serveFrontendApp` (`artifacts/api-server/src/app.ts`) checks for `<frontendDir>/<path>/index.html` and serves it directly (`res.sendFile`, 200, no redirect) for extension-less GET paths; unchanged behavior for real asset requests (`/assets/*.js` etc.) and for paths with no matching snapshot (falls through to the existing SPA catch-all, unchanged) |
| `robots.txt` | Add `Disallow` entries for `/wiki`, `/tornei`, `/support`, `/welcome`, `/styleguide` |
| GSC/GA4 | Documentation only (runbook appended to `docs/seo/keyword-strategy.md`'s existing operational checklist); no code |

## Components

### 1. `scripts/prerender.ts` — hard-fail on bad output

- Add a `data-root-error-boundary` attribute to the fallback `<div>` rendered
  by `src/components/RootErrorBoundary.tsx` (currently identified only by a
  generic `role="alert"`, which collides with legitimate `Alert`/form-field
  usage elsewhere — not safe to match on).
- Extract a new pure helper, e.g. `artifacts/trader-dashboard/scripts/seoSnapshot.ts`
  exporting `isValidSnapshot(html: string): boolean`, so it's unit-testable
  without spinning up Chromium. Rejects on:
  - missing `<h1` in the captured HTML, or
  - presence of `data-root-error-boundary` (unambiguous, language-independent).
- `main()` in `prerender.ts` calls this after each `page.content()` capture;
  if invalid, it collects the failing path(s), still finishes the loop (so one
  bad page doesn't hide others), then `process.exit(1)` with a summary of
  which paths failed and why.
- Missing `puppeteer`/`sirv` (import failure) also becomes a hard failure
  (`process.exit(1)`) instead of a warn-and-return, now that they're regular
  dependencies — a missing install is a real build problem, not an expected
  degraded mode.
- No change to the successful path: still writes `<route>/index.html` under
  `dist/public`.

### 2. `artifacts/trader-dashboard/package.json`

- Move `puppeteer` and `sirv` from `optionalDependencies` to `dependencies`.

### 3. `artifacts/api-server/src/app.ts` — direct snapshot serving

- In `serveFrontendApp`, add a small middleware immediately before the
  existing `express.static(frontendDir, ...)` call: for `GET`/`HEAD` requests
  whose path has no file extension and isn't under `/api`, check whether
  `<frontendDir><path>/index.html` exists; if so `res.sendFile` it directly
  and return. Otherwise call `next()` and let the existing
  `express.static` + SPA-catch-all chain behave exactly as today (no change
  to asset serving, no change to the true-SPA-route fallback behavior for
  authenticated routes with no prerendered snapshot).
- This must not weaken caching/headers already set by `express.static` for
  assets — it only intercepts extension-less directory-style paths.

### 4. `artifacts/trader-dashboard/public/robots.txt`

- Add `Disallow: /wiki`, `Disallow: /tornei`, `Disallow: /support`,
  `Disallow: /welcome`, `Disallow: /styleguide` alongside the existing
  disallow block.

### 5. `docs/seo/keyword-strategy.md`

- Expand the existing "Off-site / operational checklist" section with a
  concrete step-by-step runbook for Google Search Console + Bing Webmaster
  Tools domain verification (HTML-file method: drop the downloaded
  verification file straight into `artifacts/trader-dashboard/public/`, no
  code change needed) and sitemap submission, plus setting
  `VITE_GA_MEASUREMENT_ID` on Railway. Marked clearly as user-executed steps,
  not automatable.

## Testing

- **Unit test** for `isValidSnapshot()` (`scripts/seoSnapshot.test.ts`): valid
  page with `<h1>` → true; page with only the error-boundary marker → false;
  empty shell → false.
- **Integration test** for the new static-serving middleware
  (`artifacts/api-server` already has Express app tests via `supertest` —
  follow that convention): a request for a path with a fixture
  `index.html` present under a temp `frontendDir` returns 200 with that exact
  body and no redirect; a request for a path with no matching directory falls
  through to the existing SPA `index.html` response (unchanged behavior
  preserved).
- **Static content test** for `robots.txt` (matching the existing
  `*.static.test.ts` convention already used for i18n/production-copy):
  asserts every currently authenticated top-level route is present in the
  `Disallow` list, so this can't silently drift again.
- Manual verification after merge: rebuild locally with a real
  `VITE_CLERK_PUBLISHABLE_KEY`, run `pnpm --filter trader-dashboard build`,
  confirm `dist/public/about/index.html` etc. contain real content and the
  build fails loudly if that file is deleted/corrupted before running
  `prerender` again.

## Out of scope (explicitly)

- Phase 2 (public blog content, Library cross-linking) — separate spec, next.
- Actually creating/verifying the GSC/Bing/GA4 accounts — user action,
  documented not automated.
- Any off-site authority work (backlinks, social profiles, Product Hunt, etc.)
  — already listed as out-of-repo in `docs/seo/keyword-strategy.md`.
