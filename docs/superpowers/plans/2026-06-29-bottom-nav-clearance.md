# Bottom-nav clearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page/section relate consistently to the floating mobile bottom-bar (and desktop sidebar) — no controls hidden behind the bar, no oversized empty gap above it — by routing all clearance through one shared CSS token.

**Architecture:** Define one responsive CSS token (`--bottom-nav-clearance`) plus a sidebar-offset token (`--app-inset-left`) in `index.css`. `PageLayout` becomes the single owner of bottom-bar clearance via these tokens. The two elements that escape `PageLayout` (Chat's dvh-sized scroll region, the CookieConsent fixed popup) reference the same token. Redundant per-page trailing padding is removed. A static test locks the tokens, the consumers, and scans for new magic-number regressions.

**Tech Stack:** React 19 + Vite, Tailwind v4 (CSS-first `@theme`/`@layer`), Wouter, Framer Motion. Tests are plain `node:assert` `*.static.test.ts` scripts run by the repo test runner with `cwd = artifacts/trader-dashboard` (`pnpm test` → `scripts/local/run-tests.ts`).

## Global Constraints

- pnpm only; Node 24; TypeScript 5.9 strict. (No edits to generated files.)
- `@typescript-eslint/no-explicit-any` = error in non-test source (tests may use `any`).
- Static tests read source via `fs.readFileSync` with paths **relative to `artifacts/trader-dashboard`** (e.g. `"src/components/PageLayout.tsx"`), because the runner sets `cwd` to the package root.
- Token math must preserve today's baseline: mobile clearance `= 76px + safe-area + 16px = 92px` (was `5.75rem`); desktop bottom `= 1.5rem` (was `lg:pb-6`); desktop left `= 5rem` (was `lg:pl-20`).
- All commits run from repo root `/Users/gazz/Desktop/TraderLoadingsLOCALE`. Commit message footer line:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Do **not** `git add -A`. Stage only the files each task names.

## File Structure

- `artifacts/trader-dashboard/src/index.css` — **Modify.** Add the clearance/inset tokens to `:root`, an `@media (min-width:1024px)` override, and two utility classes in `@layer utilities`.
- `artifacts/trader-dashboard/src/components/PageLayout.tsx` — **Modify.** Outer wrapper uses the tokens instead of magic numbers.
- `artifacts/trader-dashboard/src/pages/Chat.tsx` — **Modify.** Chat scroll region height references the token.
- `artifacts/trader-dashboard/src/components/CookieConsentPopup.tsx` — **Modify.** Lift above the bar + desktop sidebar offset.
- `artifacts/trader-dashboard/src/pages/Milestones.tsx` — **Modify.** Drop redundant `pb-24`.
- `artifacts/trader-dashboard/src/pages/ProPage.tsx` — **Modify.** Drop the final section's `pb-10`.
- `artifacts/trader-dashboard/src/pages/Routine.tsx` — **Modify.** Drop the trailing `pb-4`.
- `artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts` — **Create.** One guardrail test, built up across tasks.

All assertions live in the single test file; each task appends its block, so the file grows red→green per task.

---

### Task 1: Define the clearance token + utilities

**Files:**
- Modify: `artifacts/trader-dashboard/src/index.css` (`:root` ends at line 151; `@layer utilities` starts at line 540)
- Test: `artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts` (create)

**Interfaces:**
- Produces: CSS custom properties `--bottom-nav-band`, `--bottom-nav-clearance`, `--app-inset-left` (global, responsive); utility classes `.pb-bottom-nav`, `.bottom-nav-safe`. Later tasks reference `var(--bottom-nav-clearance)` and `var(--app-inset-left)` in Tailwind arbitrary values.

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts`:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

// Paths are relative to artifacts/trader-dashboard (the test runner's cwd).
const css = fs.readFileSync("src/index.css", "utf8");

// ── Task 1: token defined once, responsive ──────────────────────────────
assert.match(
  css,
  /--bottom-nav-band:\s*4\.75rem/,
  "index.css must define the bottom-nav band (64px pill + 12px gap = 76px)",
);
assert.match(
  css,
  /--bottom-nav-clearance:\s*calc\(var\(--bottom-nav-band\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\s*\+\s*1rem\)/,
  "clearance must be band + safe-area + 1rem (= 92px mobile, matches old 5.75rem)",
);
assert.match(
  css,
  /--app-inset-left:\s*0px/,
  "app inset-left defaults to 0 on mobile",
);
assert.match(
  css,
  /@media\s*\(min-width:\s*1024px\)[\s\S]*--bottom-nav-clearance:\s*1\.5rem/,
  "lg override: clearance collapses to 1.5rem (old lg:pb-6) when nav is the sidebar",
);
assert.match(
  css,
  /@media\s*\(min-width:\s*1024px\)[\s\S]*--app-inset-left:\s*5rem/,
  "lg override: content shifts 5rem (80px) for the sidebar (old lg:pl-20)",
);
assert.match(
  css,
  /\.pb-bottom-nav\s*\{\s*padding-bottom:\s*var\(--bottom-nav-clearance\)/,
  "convenience utility .pb-bottom-nav must exist",
);
assert.match(
  css,
  /\.bottom-nav-safe\s*\{\s*bottom:\s*var\(--bottom-nav-clearance\)/,
  "convenience utility .bottom-nav-safe must exist (anchor fixed elements above the bar)",
);

console.log("bottom-nav clearance static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard && node --import tsx src/bottom-nav-clearance.static.test.ts`
Expected: FAIL — first `assert.match` throws (`--bottom-nav-band` not found).

- [ ] **Step 3: Add the tokens to `:root`**

In `src/index.css`, insert before the closing `}` of the `:root` block (currently line 151, right after the `--radius-pill: 9999px;` line):

```css

  /* ── Bottom-nav clearance (single source of truth) ─────────────
     Mobile/tablet: floating pill bar occupies a 76px band (64px pill
     + 12px gap). Clearance = band + safe-area + 16px breathing room
     = 92px, identical to the previous 5.75rem. On lg the nav becomes
     the 80px left sidebar, so the bottom clearance collapses and the
     content shifts left instead. */
  --bottom-nav-band: 4.75rem;          /* 76px */
  --bottom-nav-clearance: calc(var(--bottom-nav-band) + env(safe-area-inset-bottom, 0px) + 1rem);
  --app-inset-left: 0px;
```

Then add the `lg` override immediately **after** the `:root { … }` block closes (after the current line 151 `}`):

```css

/* lg+: the bottom nav renders as the left sidebar — no floating bar to
   clear, so content drops its bottom clearance and gains a left offset. */
@media (min-width: 1024px) {
  :root {
    --bottom-nav-clearance: 1.5rem;    /* was lg:pb-6 */
    --app-inset-left: 5rem;            /* was lg:pl-20 (80px) */
  }
}
```

- [ ] **Step 4: Add the utility classes**

In `src/index.css`, inside the `@layer utilities {` block (starts line 540), add after the `.scrollbar-none` rules (around line 569):

```css

  /* Bottom-nav clearance helpers (read the shared token) */
  .pb-bottom-nav {
    padding-bottom: var(--bottom-nav-clearance);
  }
  .bottom-nav-safe {
    bottom: var(--bottom-nav-clearance);
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard && node --import tsx src/bottom-nav-clearance.static.test.ts`
Expected: PASS — prints `bottom-nav clearance static checks passed`.

- [ ] **Step 6: Commit**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE
git add artifacts/trader-dashboard/src/index.css artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts
git commit -m "feat(ui): add shared bottom-nav clearance token + utilities

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: PageLayout consumes the token

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/PageLayout.tsx:27`
- Test: `artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts` (append)

**Interfaces:**
- Consumes: `var(--bottom-nav-clearance)`, `var(--app-inset-left)` from Task 1.

- [ ] **Step 1: Append the failing assertions**

Append to `src/bottom-nav-clearance.static.test.ts`, **before** the final `console.log(...)` line:

```ts

// ── Task 2: PageLayout is the single owner of clearance ─────────────────
const pageLayout = fs.readFileSync("src/components/PageLayout.tsx", "utf8");
assert.match(
  pageLayout,
  /pb-\[var\(--bottom-nav-clearance\)\]/,
  "PageLayout must pad the bottom with the clearance token",
);
assert.match(
  pageLayout,
  /pl-\[var\(--app-inset-left\)\]/,
  "PageLayout must offset left with the sidebar token",
);
assert.doesNotMatch(
  pageLayout,
  /5\.75rem|6rem|lg:pl-20|lg:pb-6/,
  "PageLayout must not keep the old magic-number clearance",
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard && node --import tsx src/bottom-nav-clearance.static.test.ts`
Expected: FAIL — `pb-[var(--bottom-nav-clearance)]` not found.

- [ ] **Step 3: Edit PageLayout**

In `src/components/PageLayout.tsx`, replace the outer wrapper className on line 27.

Find:
```tsx
    <div className="relative min-h-screen overflow-x-hidden bg-background pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-6 lg:pl-20">
```
Replace with:
```tsx
    <div className="relative min-h-screen overflow-x-hidden bg-background pb-[var(--bottom-nav-clearance)] pl-[var(--app-inset-left)]">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard && node --import tsx src/bottom-nav-clearance.static.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE
git add artifacts/trader-dashboard/src/components/PageLayout.tsx artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts
git commit -m "refactor(ui): PageLayout uses shared bottom-nav clearance token

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Chat scroll region uses the token

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Chat.tsx:93`
- Test: `artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts` (append)

**Interfaces:**
- Consumes: `var(--bottom-nav-clearance)` from Task 1.

**Note on the top constant:** the chat section sits below the TopNav (`pt-[3.85rem]` ≈ 62px) + the `space-y-3` gap (12px) + the PageHeader (~52px). A generous `8.5rem` (136px) top allowance keeps the composer above the bar even when the subtitle wraps in longer languages (DE/FR); worst case is a slightly shorter chat box, never a hidden composer. Confirm/adjust in the manual verification task.

- [ ] **Step 1: Append the failing assertions**

Append to `src/bottom-nav-clearance.static.test.ts`, before the final `console.log(...)`:

```ts

// ── Task 3: Chat height is token-based, not a raw dvh magic number ───────
const chat = fs.readFileSync("src/pages/Chat.tsx", "utf8");
assert.match(
  chat,
  /calc\(100dvh\s*-\s*8\.5rem\s*-\s*var\(--bottom-nav-clearance\)\)/,
  "Chat scroll region height must subtract the clearance token",
);
assert.doesNotMatch(
  chat,
  /100dvh\s*-\s*180px/,
  "Chat must not keep the old fixed 180px viewport math",
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard && node --import tsx src/bottom-nav-clearance.static.test.ts`
Expected: FAIL — token-based height not found.

- [ ] **Step 3: Edit Chat**

In `src/pages/Chat.tsx`, replace the inline style on line 93.

Find:
```tsx
        style={{ height: "calc(100dvh - 180px)" }}
```
Replace with:
```tsx
        style={{ height: "calc(100dvh - 8.5rem - var(--bottom-nav-clearance))" }}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard && node --import tsx src/bottom-nav-clearance.static.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE
git add artifacts/trader-dashboard/src/pages/Chat.tsx artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts
git commit -m "fix(chat): tie message-area height to bottom-nav clearance token

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: CookieConsent lifts above the bar

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/CookieConsentPopup.tsx:26`
- Test: `artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts` (append)

**Interfaces:**
- Consumes: `var(--bottom-nav-clearance)`, `var(--app-inset-left)` from Task 1.

- [ ] **Step 1: Append the failing assertions**

Append to `src/bottom-nav-clearance.static.test.ts`, before the final `console.log(...)`:

```ts

// ── Task 4: CookieConsent sits above the bar, offset for the sidebar ─────
const cookie = fs.readFileSync("src/components/CookieConsentPopup.tsx", "utf8");
assert.match(
  cookie,
  /bottom-\[var\(--bottom-nav-clearance\)\]/,
  "CookieConsent must float above the mobile nav bar via the token",
);
assert.match(
  cookie,
  /lg:left-\[calc\(var\(--app-inset-left\)\+0\.75rem\)\]/,
  "CookieConsent must offset its left edge past the desktop sidebar",
);
assert.doesNotMatch(
  cookie,
  /\bbottom-3\b/,
  "CookieConsent must not keep the old bottom-3 that overlapped the nav",
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard && node --import tsx src/bottom-nav-clearance.static.test.ts`
Expected: FAIL — `bottom-[var(--bottom-nav-clearance)]` not found.

- [ ] **Step 3: Edit CookieConsentPopup**

In `src/components/CookieConsentPopup.tsx`, replace the wrapper className on line 26.

Find:
```tsx
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-xl rounded-lg border border-border bg-background/95 p-4 shadow-2xl backdrop-blur md:bottom-5">
```
Replace with:
```tsx
    <div className="fixed inset-x-3 bottom-[var(--bottom-nav-clearance)] lg:bottom-5 lg:left-[calc(var(--app-inset-left)+0.75rem)] z-[80] mx-auto max-w-xl rounded-lg border border-border bg-background/95 p-4 shadow-2xl backdrop-blur">
```

(`inset-x-3` still sets the right edge to `0.75rem`; the `lg:left-…` override re-centers the popup within the content area beside the sidebar. On lg the floating bar is gone, so `lg:bottom-5` restores the tighter desktop offset.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard && node --import tsx src/bottom-nav-clearance.static.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE
git add artifacts/trader-dashboard/src/components/CookieConsentPopup.tsx artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts
git commit -m "fix(ui): lift cookie consent above the bottom nav + sidebar offset

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Remove redundant trailing page padding

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Milestones.tsx:924`
- Modify: `artifacts/trader-dashboard/src/pages/ProPage.tsx:256`
- Modify: `artifacts/trader-dashboard/src/pages/Routine.tsx:276`
- Test: `artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts` (append)

**Interfaces:**
- Consumes: nothing new — relies on `PageLayout` (Task 2) owning the bottom clearance.

- [ ] **Step 1: Append the failing assertion**

Append to `src/bottom-nav-clearance.static.test.ts`, before the final `console.log(...)`:

```ts

// ── Task 5: no page re-pads the bottom on top of PageLayout's clearance ──
// Lock the severe offender; the broader rule ("PageLayout owns bottom
// clearance") is a documented convention, not a grep (pb-10/pb-4 values
// are too common elsewhere to assert globally without false positives).
const milestones = fs.readFileSync("src/pages/Milestones.tsx", "utf8");
assert.doesNotMatch(
  milestones,
  /pb-24/,
  "Milestones must not double the bottom clearance with pb-24",
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard && node --import tsx src/bottom-nav-clearance.static.test.ts`
Expected: FAIL — `pb-24` still present in Milestones.

- [ ] **Step 3: Edit Milestones**

In `src/pages/Milestones.tsx` line 924, remove the `pb-24`.

Find:
```tsx
      <div className="max-w-2xl mx-auto px-4 pb-24 pt-4 space-y-6">
```
Replace with:
```tsx
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
```

- [ ] **Step 4: Edit ProPage**

In `src/pages/ProPage.tsx` line 256, remove the final section's `pb-10` (this is the last `<section>` before `</PageLayout>` at line 271; do not touch the mid-page `pb-12` sections that separate earlier sections).

Find:
```tsx
        <motion.section {...sectionMotion} className="relative px-4 pb-10">
```
Replace with:
```tsx
        <motion.section {...sectionMotion} className="relative px-4">
```

- [ ] **Step 5: Edit Routine**

In `src/pages/Routine.tsx` line 276, remove the trailing `pb-4` on the footer text.

Find:
```tsx
          className="text-center text-sm italic text-muted-foreground/30 pb-4"
```
Replace with:
```tsx
          className="text-center text-sm italic text-muted-foreground/30"
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard && node --import tsx src/bottom-nav-clearance.static.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE
git add artifacts/trader-dashboard/src/pages/Milestones.tsx artifacts/trader-dashboard/src/pages/ProPage.tsx artifacts/trader-dashboard/src/pages/Routine.tsx artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts
git commit -m "fix(ui): drop redundant trailing bottom padding (Milestones/ProPage/Routine)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Cross-file regression scan + full verify

**Files:**
- Test: `artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts` (append)

**Interfaces:**
- Consumes: the finished state of all prior tasks.

- [ ] **Step 1: Append the cross-file scan**

Append to `src/bottom-nav-clearance.static.test.ts`, before the final `console.log(...)`:

```ts

// ── Task 6: forbid NEW magic-number bottom anchoring across the app ──────
// Full-screen overlays legitimately pin to bottom-0; the cookie popup and
// the nav itself are the sanctioned floating bars. Everything else must use
// the token rather than re-introducing fixed bottom-[n] / calc(100dvh-Npx).
const ALLOWLIST = new Set([
  "src/components/BottomNav.tsx",          // the nav itself
  "src/components/CookieConsentPopup.tsx", // sanctioned floating popup (token-based)
  "src/components/PairSelectionModal.tsx", // full-screen bottom sheet (overlay)
  "src/components/ui/sheet.tsx",           // overlay primitive
  "src/components/ui/drawer.tsx",          // overlay primitive
  "src/components/ui/toast.tsx",           // toast viewport
  "src/components/social/StoryViewer.tsx", // full-screen story overlay
]);

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(full, out);
    } else if (entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
}

const tsxFiles: string[] = [];
walk("src/components", tsxFiles);
walk("src/pages", tsxFiles);

const fixedBottomMagic = /fixed[^"'`]*\bbottom-(?:0|3|5|\[(?!var\()[^\]]*\])/;
const dvhMagic = /calc\(100dvh\s*-\s*\d+px\)/;

for (const file of tsxFiles) {
  if (ALLOWLIST.has(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(
    src,
    fixedBottomMagic,
    `${file}: fixed element anchored to the bottom with a magic number — use bottom-[var(--bottom-nav-clearance)] / .bottom-nav-safe (or add to the overlay allowlist)`,
  );
  assert.doesNotMatch(
    src,
    dvhMagic,
    `${file}: raw "calc(100dvh - Npx)" — subtract var(--bottom-nav-clearance) instead`,
  );
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard && node --import tsx src/bottom-nav-clearance.static.test.ts`
Expected: PASS. (If it fails, the named file either needs the token or belongs in `ALLOWLIST` because it is a genuine full-screen overlay — judge per the file.)

- [ ] **Step 3: Run the full gate**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm verify`
Expected: install → codegen → typecheck → test → build all pass; the new test is discovered and counted; no other test regresses.

- [ ] **Step 4: Commit**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE
git add artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts
git commit -m "test(ui): guardrail against new magic-number bottom-nav clearance

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Manual browser verification

**Files:** none (verification only).

This task has no code; it satisfies `verification-before-completion` for the visual behavior the static tests cannot prove.

- [ ] **Step 1: Start the app**

Run: `cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm start:local`
Open the Vite URL (default `http://localhost:5173`).

- [ ] **Step 2: Mobile-viewport checks (DevTools device toolbar, e.g. iPhone with safe-area)**

Confirm each, with the device toolbar at a small height (≤700px) and a safe-area-inset device profile:
- **Chat** (`/chat`, Messaggi tab, open a conversation): the message input + send button sit fully **above** the floating bar, with a small gap — not hidden behind it, and no large empty gap below the input.
- **Cookie popup** (clear `localStorage` key for consent, reload): the popup floats **above** the bar; both the text and "Accetta" button are fully visible; nav buttons are not covered.
- **Milestones** (`/milestones`), **ProPage** (`/pro`), **Routine** (`/routine`): scrolled to the end, the last content sits a **small, consistent** distance above the bar — no oversized gap.
- **Spot-check baseline** (`/`, `/journal`, `/settings`): last content clears the bar by the same small margin as before (no regression).

- [ ] **Step 3: Tune the Chat top constant if needed**

If in Step 2 the Chat composer is hidden behind the bar (top underestimated) or leaves a large gap (overestimated), adjust the `8.5rem` in `src/pages/Chat.tsx` and the matching assertion in `bottom-nav-clearance.static.test.ts`, re-run the static test, and re-verify. Also check a long-text language (Settings → German) for subtitle wrap.

- [ ] **Step 4: Desktop checks (≥1024px)**

- Content is offset by the 80px sidebar (no content under it), bottom gap is the tight desktop value, and the cookie popup is centred in the content area beside the sidebar.

- [ ] **Step 5: If anything was tuned, commit the adjustment**

```bash
cd /Users/gazz/Desktop/TraderLoadingsLOCALE
git add artifacts/trader-dashboard/src/pages/Chat.tsx artifacts/trader-dashboard/src/bottom-nav-clearance.static.test.ts
git commit -m "fix(chat): tune message-area top allowance after browser verification

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §3.1 token → Task 1. ✓
- §3.2 PageLayout → Task 2. ✓
- §3.3 Chat + CookieConsent fixes → Tasks 3, 4. ✓
- §3.4 redundant padding removal (Milestones/ProPage/Routine) → Task 5. ✓
- §3.5 guardrail (token defined, consumers reference it, no new fixed-bottom/dvh magic, Milestones lock + honest limitation) → assertions across Tasks 1–6. ✓
- §5 testing & verification (static-first, `pnpm verify`, manual browser) → Tasks 1–6 steps + Task 7. ✓
- §6 out-of-scope (Admin, marketing pages, nav redesign) → not touched. ✓

**Placeholder scan:** No TBD/TODO. The Chat `8.5rem` is a concrete value with an explicit calibration step (Task 7 Step 3), not a placeholder. All edits show exact find/replace strings.

**Type/identifier consistency:** Token names (`--bottom-nav-band`, `--bottom-nav-clearance`, `--app-inset-left`), utility names (`.pb-bottom-nav`, `.bottom-nav-safe`), and the test file path (`src/bottom-nav-clearance.static.test.ts`) are used identically across all tasks. The Chat height string asserted in Task 3 matches the edit in Task 3 Step 3 character-for-character. The CookieConsent `lg:left-[calc(var(--app-inset-left)+0.75rem)]` asserted in Task 4 matches its edit.
