# SEO/GEO Technical Hardening (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the site's existing SEO/GEO infrastructure (prerendering, static serving, robots.txt) fail loudly instead of silently degrading, so search/AI crawlers reliably see real content.

**Architecture:** Four independent, additive changes to existing files: (1) a stable DOM marker on the app's error-boundary fallback so a broken render can be detected programmatically, (2) a pure content-validator used by the prerender script to hard-fail the build on bad snapshots, (3) a pure path-resolver used by the Express static-serving layer to skip the redirect hop for prerendered pages, (4) a `robots.txt` content fix. No new runtime dependencies except promoting two already-used packages from optional to required.

**Tech Stack:** TypeScript, React (trader-dashboard), Express 5 (api-server), tsx-run `node:assert/strict` tests (existing monorepo convention — no test framework, no supertest).

## Global Constraints

- `@typescript-eslint/no-explicit-any` = error in non-test source; tests may use `any`.
- Semantic commits with scope (`feat(seo):`, `fix(seo):`, `test(seo):`).
- Don't run `prettier --write` on `artifacts/api-server` files (HEAD isn't prettier-clean).
- Tests are plain `.test.ts` files using `node:assert/strict`, no `describe`/`it` wrapper — follow the exact style in `artifacts/trader-dashboard/src/brand-name.static.test.ts`.
- Every step's file paths are exact; commit after each task.

---

## File Structure

| File | Responsibility |
|---|---|
| `artifacts/trader-dashboard/src/components/RootErrorBoundary.tsx` | Modified: add a `data-root-error-boundary` marker attribute |
| `artifacts/trader-dashboard/src/components/RootErrorBoundary.static.test.ts` | New: asserts the marker is present in source |
| `artifacts/trader-dashboard/scripts/seoSnapshot.ts` | New: pure `isValidSnapshot(html)` validator |
| `artifacts/trader-dashboard/scripts/seoSnapshot.test.ts` | New: unit tests for the validator |
| `artifacts/trader-dashboard/scripts/prerender.ts` | Modified: hard-fail on missing deps / launch failure / invalid snapshot |
| `artifacts/trader-dashboard/package.json` | Modified: `puppeteer`/`sirv` moved to `dependencies` |
| `artifacts/api-server/src/lib/staticSnapshot.ts` | New: pure `resolveSnapshotIndexPath(frontendDir, requestPath)` |
| `artifacts/api-server/src/lib/staticSnapshot.test.ts` | New: unit tests for the resolver (incl. path-traversal guard) |
| `artifacts/api-server/src/app.ts` | Modified: wire the resolver into `serveFrontendApp` before `express.static` |
| `artifacts/trader-dashboard/public/robots.txt` | Modified: add missing `Disallow` entries |
| `artifacts/trader-dashboard/src/robots.static.test.ts` | New: asserts every authenticated route is disallowed |
| `docs/seo/keyword-strategy.md` | Modified: expand the operational checklist into a concrete GSC/Bing/GA4 runbook |

---

### Task 1: Error-boundary marker

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/RootErrorBoundary.tsx:43`
- Test: `artifacts/trader-dashboard/src/components/RootErrorBoundary.static.test.ts`

**Interfaces:**
- Produces: a `data-root-error-boundary` attribute always present on the fallback `<div>`, consumed by Task 2's `isValidSnapshot`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/components/RootErrorBoundary.static.test.ts`:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "src/components/RootErrorBoundary.tsx",
  "utf8",
);

assert.match(
  source,
  /data-root-error-boundary/,
  "RootErrorBoundary fallback must carry a data-root-error-boundary marker so prerender validation can detect a crashed render",
);

console.log("RootErrorBoundary marker static check passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `artifacts/trader-dashboard`): `npx tsx src/components/RootErrorBoundary.static.test.ts`
Expected: throws `AssertionError` (marker not found).

- [ ] **Step 3: Add the marker**

In `artifacts/trader-dashboard/src/components/RootErrorBoundary.tsx`, change:

```tsx
      <div
        role="alert"
        style={{
```

to:

```tsx
      <div
        role="alert"
        data-root-error-boundary
        style={{
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/components/RootErrorBoundary.static.test.ts`
Expected: prints `RootErrorBoundary marker static check passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/RootErrorBoundary.tsx artifacts/trader-dashboard/src/components/RootErrorBoundary.static.test.ts
git commit -m "feat(seo): mark RootErrorBoundary fallback for prerender crash detection"
```

---

### Task 2: Snapshot content validator

**Files:**
- Create: `artifacts/trader-dashboard/scripts/seoSnapshot.ts`
- Test: `artifacts/trader-dashboard/scripts/seoSnapshot.test.ts`

**Interfaces:**
- Produces: `isValidSnapshot(html: string): boolean` — consumed by Task 3's `prerender.ts`.
- Consumes: the `data-root-error-boundary` marker from Task 1.

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/scripts/seoSnapshot.test.ts`:

```ts
import assert from "node:assert/strict";
import { isValidSnapshot } from "./seoSnapshot.ts";

const goodPage = `<!DOCTYPE html><html><body><div id="root"><h1>Trading journal</h1><p>Track every trade.</p></div></body></html>`;
assert.equal(isValidSnapshot(goodPage), true, "a real page with an h1 and no error marker must be valid");

const crashedPage = `<!DOCTYPE html><html><body><div id="root"><div role="alert" data-root-error-boundary><h1>Something went wrong</h1></div></body></html>`;
assert.equal(isValidSnapshot(crashedPage), false, "a page rendering the error boundary must be invalid even though it has an <h1>");

const emptyShell = `<!DOCTYPE html><html><body><div id="root"></div></body></html>`;
assert.equal(isValidSnapshot(emptyShell), false, "an empty SPA shell with no h1 must be invalid");

console.log("seoSnapshot validator tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `artifacts/trader-dashboard`): `npx tsx scripts/seoSnapshot.test.ts`
Expected: fails with a module-not-found error for `./seoSnapshot.ts`.

- [ ] **Step 3: Write the implementation**

Create `artifacts/trader-dashboard/scripts/seoSnapshot.ts`:

```ts
/**
 * Decides whether a prerendered snapshot is real content or a broken render.
 * Checked BEFORE the error-boundary's own <h1>("Something went wrong") could
 * otherwise pass a naive "has an h1" check.
 */
export function isValidSnapshot(html: string): boolean {
  if (html.includes("data-root-error-boundary")) return false;
  if (!/<h1[\s>]/.test(html)) return false;
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/seoSnapshot.test.ts`
Expected: prints `seoSnapshot validator tests passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/scripts/seoSnapshot.ts artifacts/trader-dashboard/scripts/seoSnapshot.test.ts
git commit -m "feat(seo): add pure snapshot content validator"
```

---

### Task 3: Hard-fail prerendering

**Files:**
- Modify: `artifacts/trader-dashboard/scripts/prerender.ts`
- Modify: `artifacts/trader-dashboard/package.json:99-102`

**Interfaces:**
- Consumes: `isValidSnapshot` from Task 2 (`./seoSnapshot.ts`).
- Produces: `prerender.ts` now exits `1` (not `0`) on any of: missing `puppeteer`/`sirv`, browser launch failure, or any route's captured HTML failing `isValidSnapshot`. Unchanged: still writes `<route>/index.html` for every route that passes validation.

- [ ] **Step 1: Move puppeteer/sirv to required dependencies**

In `artifacts/trader-dashboard/package.json`, delete the `optionalDependencies` block:

```json
  "optionalDependencies": {
    "puppeteer": "^24.10.0",
    "sirv": "^3.0.0"
  }
```

and add the two packages into the existing `"dependencies"` block in alphabetical order — insert `"puppeteer": "^24.10.0",` immediately before the existing `"recharts": "^2.15.2",` line, and insert `"sirv": "^3.0.0",` immediately before the existing `"sonner": "^2.0.7",` line, so that section reads:

```json
    "react-resizable-panels": "^2.1.7",
    "puppeteer": "^24.10.0",
    "recharts": "^2.15.2",
    "sirv": "^3.0.0",
    "sonner": "^2.0.7",
```

(Keep `react-resizable-panels` where it already is — only the two new lines are inserted, and the trailing `}` that used to close `optionalDependencies` is removed along with the now-empty block, leaving `"dependencies": { ... }` as the last top-level key.)

- [ ] **Step 2: Run `pnpm install` to move the lockfile entries**

Run (from repo root): `pnpm install --filter @workspace/trader-dashboard...`
Expected: exits 0; `pnpm-lock.yaml` updates to reflect `puppeteer`/`sirv` as regular dependencies of `trader-dashboard`.

- [ ] **Step 3: Rewrite `prerender.ts` to hard-fail**

Replace the full contents of `artifacts/trader-dashboard/scripts/prerender.ts` with:

```ts
/**
 * Prerender the public marketing surface to static HTML so non-JS crawlers
 * (GPTBot, PerplexityBot, ClaudeBot, Bingbot, …) and search engines see fully
 * rendered, per-language content + head tags.
 *
 * Approach: serve the freshly built dist/public with a tiny static server, drive
 * a headless Chromium over every public route × language, and snapshot the
 * settled DOM to <route>/index.html.
 *
 * Hard-fail by design: puppeteer/sirv are required dependencies, and every
 * captured snapshot is validated (see ./seoSnapshot.ts) before being written.
 * A missing dependency, a browser launch failure, or ANY route failing
 * validation exits the process with a non-zero code so a broken deploy never
 * silently ships bad content to crawlers.
 *
 * Run via tsx as part of `pnpm build` (after `vite build` + sitemap).
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { allMarketingPaths } from "../src/lib/seo.ts";
import { isValidSnapshot } from "./seoSnapshot.ts";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, "../dist/public");

function fail(message: string): never {
  console.error(`prerender: FAILED — ${message}`);
  process.exit(1);
}

async function main() {
  if (!existsSync(resolve(distDir, "index.html"))) {
    fail(`no build at ${distDir} (run vite build first)`);
  }

  let sirv: typeof import("sirv").default;
  let puppeteer: typeof import("puppeteer").default;
  try {
    sirv = (await import("sirv")).default;
    puppeteer = (await import("puppeteer")).default;
  } catch (err) {
    fail(`puppeteer/sirv failed to import — ${(err as Error).message}`);
  }

  const serveStatic = sirv(distDir, { single: true, dev: false });
  const server = createServer((req, res) =>
    serveStatic(req, res, () => {
      res.statusCode = 404;
      res.end("not found");
    }),
  );
  await new Promise<void>((ok) => server.listen(0, ok));
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  const failures: string[] = [];
  try {
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    } catch (err) {
      fail(`Chromium failed to launch — ${(err as Error).message}`);
    }

    // allMarketingPaths() already includes "/" (English x-default) + every
    // /{lang} landing and localized keyword page.
    const paths = Array.from(new Set(allMarketingPaths()));
    let done = 0;

    for (const path of paths) {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
      // Abort cross-origin requests (Google Fonts, etc.) so rendering is fast and
      // deterministic and never stalls on third-party network.
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (req.url().startsWith(origin)) req.continue();
        else req.abort();
      });
      try {
        await page.goto(`${origin}${path}`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForSelector("h1", { timeout: 15000 }).catch(() => {});
        // Let the <Seo> effect populate canonical/hreflang/JSON-LD.
        await new Promise((r) => setTimeout(r, 300));
        const html = await page.content();
        if (!isValidSnapshot(html)) {
          failures.push(`${path} — captured HTML failed content validation`);
          continue;
        }
        const outFile =
          path === "/"
            ? resolve(distDir, "index.html")
            : resolve(distDir, `${path.replace(/^\//, "")}/index.html`);
        mkdirSync(dirname(outFile), { recursive: true });
        writeFileSync(outFile, `<!DOCTYPE html>\n${html}`, "utf8");
        done += 1;
      } catch (err) {
        failures.push(`${path} — ${(err as Error).message}`);
      } finally {
        await page.close();
      }
    }
    console.log(`prerender: wrote ${done}/${paths.length} routes`);
    if (failures.length > 0) {
      console.error(`prerender: ${failures.length} route(s) failed:`);
      for (const f of failures) console.error(`  - ${f}`);
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(`prerender: FAILED — ${(err as Error).message}`);
  process.exit(1);
});
```

- [ ] **Step 4: Verify locally with a real build**

Run (from `artifacts/trader-dashboard`, with a valid Clerk dev key exported — see `.env.local` for `VITE_CLERK_PUBLISHABLE_KEY`):

```bash
VITE_CLERK_PUBLISHABLE_KEY=$(grep VITE_CLERK_PUBLISHABLE_KEY ../../.env.local | cut -d= -f2) npx vite build --config vite.config.ts && npx tsx scripts/prerender.ts
```

Expected: `prerender: wrote 45/45 routes`, exit code 0, no failures printed. Confirm `dist/public/about/index.html` contains a real `<h1>` (not the error boundary) — e.g. `grep -c data-root-error-boundary dist/public/about/index.html` prints `0`.

Then clean up the local build artifact (it's gitignored, not meant to be committed): `rm -rf dist`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/scripts/prerender.ts artifacts/trader-dashboard/package.json pnpm-lock.yaml
git commit -m "feat(seo): hard-fail prerendering on missing deps or invalid snapshots"
```

---

### Task 4: Direct snapshot serving (no redirect hop)

**Files:**
- Create: `artifacts/api-server/src/lib/staticSnapshot.ts`
- Test: `artifacts/api-server/src/lib/staticSnapshot.test.ts`
- Modify: `artifacts/api-server/src/app.ts:119-141`

**Interfaces:**
- Produces: `resolveSnapshotIndexPath(frontendDir: string, requestPath: string): string | null` — returns the absolute path to a prerendered `index.html` if one exists for an extension-less path, else `null`. Consumed by `serveFrontendApp` in `app.ts`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/lib/staticSnapshot.test.ts`:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveSnapshotIndexPath } from "./staticSnapshot.ts";

const frontendDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-test-"));
fs.mkdirSync(path.join(frontendDir, "about"), { recursive: true });
fs.writeFileSync(path.join(frontendDir, "about", "index.html"), "<h1>About</h1>");
fs.writeFileSync(path.join(frontendDir, "index.html"), "<h1>Home</h1>");

// existing prerendered route resolves
assert.equal(
  resolveSnapshotIndexPath(frontendDir, "/about"),
  path.join(frontendDir, "about", "index.html"),
);

// no matching directory -> null (falls through to SPA catch-all)
assert.equal(resolveSnapshotIndexPath(frontendDir, "/journal"), null);

// a path with a file extension is never treated as a snapshot directory
assert.equal(resolveSnapshotIndexPath(frontendDir, "/assets/index-abc123.js"), null);

// path traversal is rejected even though it has no extension
assert.equal(resolveSnapshotIndexPath(frontendDir, "/../../etc/passwd"), null);

fs.rmSync(frontendDir, { recursive: true, force: true });
console.log("staticSnapshot resolver tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `artifacts/api-server`): `npx tsx src/lib/staticSnapshot.test.ts`
Expected: fails with a module-not-found error for `./staticSnapshot.ts`.

- [ ] **Step 3: Write the implementation**

Create `artifacts/api-server/src/lib/staticSnapshot.ts`:

```ts
import fs from "node:fs";
import path from "node:path";

/**
 * Resolves an extension-less request path (e.g. "/about") to a prerendered
 * `<frontendDir>/about/index.html` snapshot if one exists, so it can be sent
 * directly (200) instead of falling through to express.static's default
 * directory-redirect-then-serve behavior (301 to "/about/", then 200).
 */
export function resolveSnapshotIndexPath(
  frontendDir: string,
  requestPath: string,
): string | null {
  if (path.extname(requestPath)) return null;

  const resolvedFrontendDir = path.resolve(frontendDir);
  const candidate = path.resolve(resolvedFrontendDir, `.${requestPath}`, "index.html");

  if (
    candidate !== path.join(resolvedFrontendDir, "index.html") &&
    !candidate.startsWith(resolvedFrontendDir + path.sep)
  ) {
    return null;
  }

  return fs.existsSync(candidate) ? candidate : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/lib/staticSnapshot.test.ts`
Expected: prints `staticSnapshot resolver tests passed`, exit code 0.

- [ ] **Step 5: Wire the resolver into `app.ts`**

In `artifacts/api-server/src/app.ts`, add the import near the other `./lib/*` imports (after line 19, `import { getUploadsDir } from "./lib/uploads";`):

```ts
import { resolveSnapshotIndexPath } from "./lib/staticSnapshot";
```

Then change the `serveFrontendApp` function (currently lines 119-141) from:

```ts
  expressApp.use(
    express.static(frontendDir, {
      immutable: true,
      maxAge: "1y",
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-store");
        }
      },
    }),
  );
```

to:

```ts
  expressApp.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    const snapshotPath = resolveSnapshotIndexPath(frontendDir, req.path);
    if (snapshotPath) {
      res.setHeader("Cache-Control", "no-store");
      res.sendFile(snapshotPath);
      return;
    }
    next();
  });

  expressApp.use(
    express.static(frontendDir, {
      immutable: true,
      maxAge: "1y",
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-store");
        }
      },
    }),
  );
```

(The rest of `serveFrontendApp` — the SPA catch-all at the end — is unchanged.)

- [ ] **Step 6: Manual verification**

From `artifacts/trader-dashboard`, build with a valid Clerk key (as in Task 3 Step 4) and run prerender so `dist/public/about/index.html` exists. Then from `artifacts/api-server`, start the server locally (`pnpm dev` or equivalent per `README-BRAIN.md`) and run:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3001/about
```

Expected: `200 ` (no redirect URL) — confirms the snapshot is served directly with no 301 hop. Then confirm an authenticated-only route with no snapshot still falls back correctly:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/journal
```

Expected: `200` (serves the root SPA `index.html` via the unchanged catch-all, same as before this change).

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/lib/staticSnapshot.ts artifacts/api-server/src/lib/staticSnapshot.test.ts artifacts/api-server/src/app.ts
git commit -m "feat(seo): serve prerendered snapshots directly, skip the redirect hop"
```

---

### Task 5: Close the robots.txt drift

**Files:**
- Modify: `artifacts/trader-dashboard/public/robots.txt`
- Test: `artifacts/trader-dashboard/src/robots.static.test.ts`

**Interfaces:** none (leaf task).

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/robots.static.test.ts`:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

const robots = fs.readFileSync("public/robots.txt", "utf8");

// Every authenticated-app top-level route (App.tsx AppRouter) must be disallowed
// for anonymous crawlers.
const authenticatedRoutes = [
  "/journal",
  "/zen",
  "/chat",
  "/news",
  "/routine",
  "/broker",
  "/calendar",
  "/milestones",
  "/missions",
  "/clock",
  "/checklist",
  "/library",
  "/settings",
  "/tools",
  "/pro",
  "/admin",
  "/wiki",
  "/tornei",
  "/support",
  "/welcome",
  "/styleguide",
];

for (const route of authenticatedRoutes) {
  assert.match(
    robots,
    new RegExp(`Disallow: ${route.replace(/\//g, "\\/")}(\\$|\\n)`),
    `robots.txt must disallow ${route}`,
  );
}

console.log("robots.txt static check passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `artifacts/trader-dashboard`): `npx tsx src/robots.static.test.ts`
Expected: `AssertionError` for `/wiki` (first missing entry).

- [ ] **Step 3: Update robots.txt**

In `artifacts/trader-dashboard/public/robots.txt`, change:

```
Disallow: /pro
Disallow: /admin
Disallow: /api/
```

to:

```
Disallow: /pro
Disallow: /admin
Disallow: /wiki
Disallow: /tornei
Disallow: /support
Disallow: /welcome
Disallow: /styleguide
Disallow: /api/
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/robots.static.test.ts`
Expected: prints `robots.txt static check passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/public/robots.txt artifacts/trader-dashboard/src/robots.static.test.ts
git commit -m "fix(seo): close robots.txt drift — disallow wiki/tornei/support/welcome/styleguide"
```

---

### Task 6: GSC/Bing/GA4 runbook (documentation only)

**Files:**
- Modify: `docs/seo/keyword-strategy.md` (the existing "Off-site / operational checklist" section)

**Interfaces:** none.

- [ ] **Step 1: Replace the checklist with a concrete runbook**

In `docs/seo/keyword-strategy.md`, replace the section starting at `## Off-site / operational checklist (NOT in the repo — required for head terms)` with:

```markdown
## Off-site / operational checklist (NOT in the repo — required for head terms)

These are user-executed steps (require owning the Google/Bing/GA4 accounts);
nothing here can be automated from the repo.

1. **Google Search Console**: at https://search.google.com/search-console,
   add property `traderloading.com` (Domain property, or URL-prefix
   `https://traderloading.com/`). Verify via the **HTML file** method: download
   the `google<code>.html` file GSC gives you and drop it directly into
   `artifacts/trader-dashboard/public/` (it's served as a static file with no
   code change) — commit and deploy, then click "Verify" in GSC. Once
   verified: Sitemaps → submit `https://traderloading.com/sitemap.xml`; then
   URL Inspection → request indexing for `/`, `/it`, `/trading-journal`,
   `/backtesting`, `/guide` (the highest-intent pages) so Google crawls them
   proactively instead of waiting for organic discovery.
2. **Bing Webmaster Tools**: at https://www.bing.com/webmasters, same flow
   (Bing also serves ChatGPT/Copilot's web search, so this feeds GEO too).
   Bing supports **importing verified GSC sites directly** — use that instead
   of a second manual verification.
3. **GA4**: create a GA4 property in Google Analytics, copy the Measurement ID
   (`G-XXXXXXX`), set it as `VITE_GA_MEASUREMENT_ID` in the Railway service
   variables (it's a `[BUILD]`-time var — see `.env.railway.example`), redeploy.
   The app is already wired to no-op safely without it
   (`src/lib/analytics.ts`) and to respect cookie consent once set.
4. **Confirm crawlability post-deploy**: after the Phase 1 code changes ship,
   `curl -sI https://traderloading.com/about` and `.../it/chi-siamo` — expect
   `HTTP/1.1 200` with no redirect (confirms Task 4 reached production), and
   `curl -s https://traderloading.com/about | grep -c '<h1'` — expect `1`
   (confirms the prerendered snapshot, not the empty SPA shell, is what's
   served).
```

This is a documentation-only change — no test.

- [ ] **Step 2: Commit**

```bash
git add docs/seo/keyword-strategy.md
git commit -m "docs(seo): concrete GSC/Bing/GA4 verification runbook"
```

---

## Self-Review

**Spec coverage:**
- Prerender hard-fail on missing deps/launch failure/invalid content → Task 3. ✓
- Content validation via a stable, language-independent marker → Tasks 1 + 2. ✓
- `puppeteer`/`sirv` moved to `dependencies` → Task 3 Step 1. ✓
- Redirect-hop elimination → Task 4. ✓
- `robots.txt` drift closed → Task 5. ✓
- GSC/Bing/GA4 documented as user-executed, not automated → Task 6. ✓
- Out-of-scope items (Phase 2 blog, off-site authority) → correctly left untouched. ✓

**Placeholder scan:** no TBD/TODO; every step has literal file paths, full code, and exact commands with expected output.

**Type consistency:** `isValidSnapshot(html: string): boolean` (Task 2) is imported and called identically in Task 3. `resolveSnapshotIndexPath(frontendDir: string, requestPath: string): string | null` (Task 4) is imported and called identically in `app.ts`. Both signatures match between definition and use sites.

**Task order note:** Tasks 1–5 have no cross-dependencies except Task 3 imports Task 2's `isValidSnapshot` and (indirectly, via the marker string) Task 1's change — so execute in the numbered order. Task 4 and Task 5 are independent of 1-3 and of each other; Task 6 is independent of all code tasks.
