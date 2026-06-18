# Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a uniform liquid-glass / neutral-jade design-system foundation (tokens, glass material, motion, refactored core primitives, a `/styleguide` reference) that all three surfaces consume, without breaking the existing 222 components.

**Architecture:** Redefine the CSS token layer (neutral graphite ramp + desaturated jade accent + glass + motion tokens) in `src/index.css`, author four liquid-glass material tiers in `@layer components`, re-express legacy class names as aliases over those tiers so existing markup upgrades for free, then refactor ~10 core `components/ui/*` primitives to consume the new material. A `/styleguide` route renders everything for visual verification.

**Tech Stack:** React 19, Tailwind CSS 4 (`@theme inline` + `:root` HSL channels), shadcn/ui (new-york), Wouter router, TypeScript strict. Tests are plain Node `assert` static scripts (`*.static.test.ts`) run by `pnpm test`.

## Global Constraints

- **Color convention:** HSL channels in `:root` (e.g. `--x: 220 24% 5%`), surfaced via `hsl(var(--x))`. Never introduce hex in `:root`.
- **Trading P&L semantics are functional, kept vivid:** `--success` (win), `--destructive` (loss), `--warning` (break-even) stay saturated. They are NOT part of the neutralized chrome.
- **Backward compatibility:** existing class names (`.tl-panel`, `.tl-panel-muted`, `.tl-toolbar`, `.tl-icon-button`, `.glass-card`, `.card-glow-primary`, `.metric-card`, neon-glow utilities) must keep working — re-expressed over the new material. No mass edits to consumer components in this plan.
- **Primitive public API frozen:** exported component names and props in `components/ui/*` do not change; only internal classes/material change.
- **i18n guard:** `src/production-copy.static.test.ts` scans `components/`, `pages/`, `contexts/`, `lib/` but **excludes any path containing `/components/ui/`**. The styleguide lives under `src/components/ui/styleguide/` so it is exempt without touching the guard. See [[i18n-enforced-new-ui]].
- **Dark-only.** No light mode in this phase.
- **Motion:** every animation stays under the existing `@media (prefers-reduced-motion: reduce)` guard in `@layer base`.
- **Tooling:** `pnpm only`. Don't `prettier --write` (HEAD isn't prettier-clean). Gate is `pnpm verify` from repo root.
- **Test run command (single file):** from repo root —
  `pnpm --filter ./scripts exec tsx <ABSOLUTE path to the .static.test.ts>` (these tests read sources via `new URL(..., import.meta.url)`, so cwd does not matter). Full suite: `pnpm test`.

---

### Task 1: Token layer + presence & contrast tests

**Files:**
- Modify: `artifacts/trader-dashboard/src/index.css` (the `@theme inline` block lines 5-50 and the `:root` block lines 53-101)
- Create: `artifacts/trader-dashboard/src/design-tokens.static.test.ts`
- Create: `artifacts/trader-dashboard/src/design-contrast.static.test.ts`

**Interfaces:**
- Produces (consumed by every later task): CSS custom properties
  `--surface-0..3`, `--border-subtle`, `--border-strong`, `--text-hi`, `--text-lo`,
  `--text-faint`, `--accent-jade`, `--accent-jade-soft`, `--glass-blur-bar|panel|raised|inset`,
  `--glass-tint`, `--glass-border`, `--glass-highlight`, `--glass-shadow`, `--glass-glow`,
  `--ease-glass`, `--ease-spring`, `--ease-out`, `--dur-fast|base|slow|slower`,
  `--radius-sm|md|lg|pill`. shadcn aliases (`--background`, `--card`, `--primary`, `--ring`, …)
  re-point to the ramp/jade.

- [ ] **Step 1: Write the failing presence test**

Create `artifacts/trader-dashboard/src/design-tokens.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

const requiredTokens = [
  "--surface-0", "--surface-1", "--surface-2", "--surface-3",
  "--border-subtle", "--border-strong",
  "--text-hi", "--text-lo", "--text-faint",
  "--accent-jade", "--accent-jade-soft",
  "--glass-blur-bar", "--glass-blur-panel", "--glass-blur-raised", "--glass-blur-inset",
  "--glass-tint", "--glass-border", "--glass-highlight", "--glass-shadow", "--glass-glow",
  "--ease-glass", "--ease-spring", "--ease-out",
  "--dur-fast", "--dur-base", "--dur-slow", "--dur-slower",
  "--radius-sm", "--radius-md", "--radius-lg", "--radius-pill",
];
for (const token of requiredTokens) {
  assert.match(css, new RegExp(`${token}\\s*:`), `index.css must define ${token}`);
}

// shadcn aliases must re-point to the new ramp/jade
assert.match(css, /--background:\s*var\(--surface-0\)/, "--background must alias --surface-0");
assert.match(css, /--primary:\s*var\(--accent-jade\)/, "--primary must alias --accent-jade");
assert.match(css, /--ring:\s*var\(--accent-jade\)/, "--ring must alias --accent-jade");

// Trading semantics must remain present and saturated (functional colors)
for (const token of ["--success", "--destructive", "--warning"]) {
  assert.match(css, new RegExp(`${token}\\s*:`), `index.css must keep ${token}`);
}

console.log("design tokens static checks passed");
```

- [ ] **Step 2: Run it; verify it FAILS**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/design-tokens.static.test.ts`
Expected: FAIL (`index.css must define --surface-0`).

- [ ] **Step 3: Rewrite the `:root` color block**

In `artifacts/trader-dashboard/src/index.css`, replace the entire `:root { … }` block (currently lines 53-101, from `:root {` through the closing `}` that contains `--radius: 0.625rem;`) with:

```css
:root {
  /* ── Neutral graphite ramp ─────────────────────────────────── */
  --surface-0: 220 24% 5%;
  --surface-1: 220 18% 9%;
  --surface-2: 220 16% 12%;
  --surface-3: 220 14% 16%;
  --border-subtle: 220 12% 20%;
  --border-strong: 220 12% 30%;
  --text-hi: 210 20% 96%;
  --text-lo: 215 14% 66%;
  --text-faint: 215 12% 46%;

  /* ── Accent: desaturated jade (chrome only) ────────────────── */
  --accent-jade: 160 34% 48%;
  --accent-jade-soft: 160 28% 60%;

  /* ── Functional trading semantics (kept vivid) ─────────────── */
  --success: 150 64% 46%;
  --success-foreground: 220 24% 6%;
  --destructive: 0 75% 60%;
  --destructive-foreground: 210 40% 98%;
  --warning: 38 92% 55%;
  --warning-foreground: 220 24% 6%;

  /* ── shadcn aliases → mapped onto the ramp / jade ──────────── */
  --background: var(--surface-0);
  --foreground: var(--text-hi);
  --card: var(--surface-1);
  --card-foreground: var(--text-hi);
  --popover: var(--surface-2);
  --popover-foreground: var(--text-hi);
  --primary: var(--accent-jade);
  --primary-foreground: 220 24% 6%;
  --secondary: var(--surface-2);
  --secondary-foreground: var(--text-hi);
  --muted: var(--surface-3);
  --muted-foreground: var(--text-lo);
  --accent: var(--accent-jade);
  --accent-foreground: 220 24% 6%;
  --border: var(--border-subtle);
  --input: var(--border-strong);
  --ring: var(--accent-jade);

  /* ── Session colors (functional domain) ────────────────────── */
  --session-asian: 262 60% 66%;
  --session-london: 35 90% 58%;
  --session-ny: 150 64% 46%;
  --session-volume: 215 14% 66%;
  --session-closed: 0 75% 60%;

  /* ── Liquid-glass material tokens ──────────────────────────── */
  --glass-blur-bar: 16px;
  --glass-blur-panel: 20px;
  --glass-blur-raised: 28px;
  --glass-blur-inset: 8px;
  --glass-tint: 220 18% 10%;
  --glass-border: 210 30% 80%;
  --glass-highlight: 210 40% 92%;
  --glass-shadow: 0 0% 0%;
  --glass-glow: 160 34% 48%;

  /* ── Legacy TL surface aliases ─────────────────────────────── */
  --tl-surface-panel: var(--surface-1);
  --tl-surface-raised: var(--surface-2);
  --tl-border-strong: var(--border-strong);
  --tl-shadow-panel: 0 10px 30px rgba(0, 0, 0, 0.34);

  /* ── Motion tokens ─────────────────────────────────────────── */
  --ease-glass: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 120ms;
  --dur-base: 200ms;
  --dur-slow: 360ms;
  --dur-slower: 600ms;

  /* ── Radii ─────────────────────────────────────────────────── */
  --radius: 0.625rem;
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-pill: 9999px;
}
```

- [ ] **Step 4: Add convenience utilities to `@theme inline`**

In `artifacts/trader-dashboard/src/index.css`, inside the existing `@theme inline { … }` block, immediately before the closing `}` (just after `--radius-2xl: 1.5rem;`), add:

```css
  --color-surface-0: hsl(var(--surface-0));
  --color-surface-1: hsl(var(--surface-1));
  --color-surface-2: hsl(var(--surface-2));
  --color-surface-3: hsl(var(--surface-3));
  --color-accent-jade: hsl(var(--accent-jade));
  --color-accent-jade-soft: hsl(var(--accent-jade-soft));
  --color-text-hi: hsl(var(--text-hi));
  --color-text-lo: hsl(var(--text-lo));
  --color-text-faint: hsl(var(--text-faint));
  --color-border-subtle: hsl(var(--border-subtle));
  --color-border-strong: hsl(var(--border-strong));

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
```

- [ ] **Step 5: Run presence test; verify it PASSES**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/design-tokens.static.test.ts`
Expected: PASS (`design tokens static checks passed`).

- [ ] **Step 6: Write the contrast test**

Create `artifacts/trader-dashboard/src/design-contrast.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

function tokenHsl(name: string): [number, number, number] {
  const m = css.match(new RegExp(`${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  assert.ok(m, `cannot read HSL token ${name}`);
  return [Number(m![1]), Number(m![2]) / 100, Number(m![3]) / 100];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

function luminance(name: string): number {
  const [r, g, b] = hslToRgb(tokenHsl(name)).map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const pairs: Array<[string, string, number]> = [
  ["--text-hi", "--surface-0", 4.5],
  ["--text-hi", "--surface-1", 4.5],
  ["--text-lo", "--surface-1", 4.5],
  ["--accent-jade", "--surface-1", 4.5],
  ["--accent-jade", "--surface-0", 4.5],
];
for (const [fg, bg, min] of pairs) {
  const ratio = contrast(fg, bg);
  assert.ok(ratio >= min, `${fg} on ${bg} contrast ${ratio.toFixed(2)} < ${min}`);
}

console.log("design contrast static checks passed");
```

- [ ] **Step 7: Run contrast test; verify it PASSES**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/design-contrast.static.test.ts`
Expected: PASS (`design contrast static checks passed`). (Values were pre-computed: all pairs ≥ 6.0.)

- [ ] **Step 8: Run the full suite to confirm no regressions**

Run (repo root): `pnpm test`
Expected: all discovered tests pass, including the existing `*.static.test.ts`.

- [ ] **Step 9: Commit**

```bash
git add artifacts/trader-dashboard/src/index.css artifacts/trader-dashboard/src/design-tokens.static.test.ts artifacts/trader-dashboard/src/design-contrast.static.test.ts
git commit -m "feat(ui): neutral graphite + jade token layer with glass/motion tokens"
```

---

### Task 2: Liquid-glass material tiers + legacy aliases

**Files:**
- Modify: `artifacts/trader-dashboard/src/index.css` (`@layer components` block — replace the legacy `.tl-panel`, `.tl-panel-muted`, `.tl-toolbar`, `.tl-icon-button` definitions near lines 207-220; and the `.glass-card` in `@layer utilities` near line 480)
- Create: `artifacts/trader-dashboard/src/design-glass.static.test.ts`

**Interfaces:**
- Consumes: glass tokens from Task 1.
- Produces (consumed by primitive tasks 4-7 and styleguide task 8): material classes
  `glass-bar`, `glass-panel`, `glass-raised`, `glass-inset`, and modifiers `glass-grain`,
  `glass-glow-accent`. Legacy `.tl-panel`/`.glass-card`/`.card-glow-primary`/`.metric-card`
  re-expressed over them.

- [ ] **Step 1: Write the failing glass test**

Create `artifacts/trader-dashboard/src/design-glass.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

for (const cls of ["glass-bar", "glass-panel", "glass-raised", "glass-inset", "glass-glow-accent"]) {
  assert.match(css, new RegExp(`\\.${cls}[\\s,{]`), `index.css must define .${cls}`);
}
// material must use backdrop blur + tint token
assert.match(css, /backdrop-filter:\s*blur/, "glass tiers must use backdrop-filter blur");
assert.match(css, /hsl\(var\(--glass-tint\)/, "glass tiers must fill from --glass-tint");
// legacy aliases must still be defined (so existing markup keeps working)
for (const cls of ["tl-panel", "glass-card", "card-glow-primary", "metric-card"]) {
  assert.match(css, new RegExp(`\\.${cls}[\\s,{]`), `legacy .${cls} must remain defined`);
}
// graceful fallback for no backdrop-filter
assert.match(css, /@supports not/, "glass must provide an @supports fallback");

console.log("design glass static checks passed");
```

- [ ] **Step 2: Run it; verify it FAILS**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/design-glass.static.test.ts`
Expected: FAIL (`index.css must define .glass-bar`).

- [ ] **Step 3: Add the material tiers**

In `artifacts/trader-dashboard/src/index.css`, inside `@layer components`, immediately after the opening `@layer components {` line, insert the material system:

```css
  /* ── Liquid-glass material system ──────────────────────────────── */
  .glass-bar,
  .glass-panel,
  .glass-raised,
  .glass-inset {
    position: relative;
    background-color: hsl(var(--glass-tint) / var(--glass-alpha, 0.72));
    border: 1px solid hsl(var(--glass-border) / 0.08);
    -webkit-backdrop-filter: blur(var(--glass-blur, 16px)) saturate(1.35);
    backdrop-filter: blur(var(--glass-blur, 16px)) saturate(1.35);
  }

  /* top specular hairline */
  .glass-bar::before,
  .glass-panel::before,
  .glass-raised::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 1px;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      transparent,
      hsl(var(--glass-highlight) / 0.5),
      transparent
    );
    pointer-events: none;
  }

  .glass-bar {
    --glass-blur: var(--glass-blur-bar);
    --glass-alpha: 0.68;
    box-shadow:
      inset 0 1px 0 hsl(var(--glass-highlight) / 0.04),
      0 8px 24px hsl(var(--glass-shadow) / 0.28);
  }
  .glass-panel {
    --glass-blur: var(--glass-blur-panel);
    --glass-alpha: 0.78;
    border-radius: var(--radius);
    box-shadow:
      inset 0 1px 0 hsl(var(--glass-highlight) / 0.05),
      inset 0 0 32px hsl(var(--glass-tint) / 0.2),
      0 12px 36px hsl(var(--glass-shadow) / 0.34);
  }
  .glass-raised {
    --glass-blur: var(--glass-blur-raised);
    --glass-alpha: 0.9;
    border-radius: var(--radius-lg);
    box-shadow:
      inset 0 1px 0 hsl(var(--glass-highlight) / 0.06),
      0 24px 64px hsl(var(--glass-shadow) / 0.5);
  }
  .glass-inset {
    --glass-blur: var(--glass-blur-inset);
    --glass-alpha: 0.5;
    border-radius: var(--radius-md);
    box-shadow: inset 0 1px 2px hsl(var(--glass-shadow) / 0.3);
  }

  /* modifiers */
  .glass-glow-accent {
    box-shadow:
      inset 0 1px 0 hsl(var(--glass-highlight) / 0.05),
      0 0 0 1px hsl(var(--glass-glow) / 0.2),
      inset 0 0 40px hsl(var(--glass-glow) / 0.12),
      0 12px 36px hsl(var(--glass-shadow) / 0.34);
  }
  .glass-grain::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    opacity: 0.04;
    background-image: radial-gradient(hsl(var(--glass-highlight)) 0.5px, transparent 0.5px);
    background-size: 3px 3px;
  }

  /* graceful fallback where backdrop-filter is unsupported */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .glass-bar,
    .glass-panel,
    .glass-raised,
    .glass-inset {
      background-color: hsl(var(--glass-tint) / 0.96);
    }
  }

  /* ── Legacy aliases over the new material ──────────────────────── */
  .tl-panel {
    composes: glass-panel;
  }
```

NOTE: Tailwind/PostCSS does not support `composes`. Instead of `composes`, append the legacy
selectors to the grouped rules above. Concretely, edit the selector lists so legacy names share
the material:
- add `, .tl-panel, .glass-card, .card-glow-primary` to the base `.glass-bar, .glass-panel, …`
  selector list **and** to the `.glass-panel` tier block;
- add `, .tl-toolbar` to the `.glass-bar` tier block;
- add `, .metric-card` to the `.glass-inset` tier block.

So the base rule becomes:

```css
  .glass-bar,
  .glass-panel,
  .glass-raised,
  .glass-inset,
  .tl-panel,
  .glass-card,
  .card-glow-primary,
  .tl-toolbar,
  .metric-card {
    position: relative;
    background-color: hsl(var(--glass-tint) / var(--glass-alpha, 0.72));
    border: 1px solid hsl(var(--glass-border) / 0.08);
    -webkit-backdrop-filter: blur(var(--glass-blur, 16px)) saturate(1.35);
    backdrop-filter: blur(var(--glass-blur, 16px)) saturate(1.35);
  }
```

and the `.glass-panel` tier rule gains `, .tl-panel, .glass-card`; `.glass-bar` gains `, .tl-toolbar`; `.glass-inset` gains `, .metric-card`; `.glass-glow-accent` gains `, .card-glow-primary`. (Do NOT use `composes`/`@apply` for these — group selectors only.)

- [ ] **Step 4: Remove the now-superseded legacy definitions**

Delete the OLD definitions so they don't override the new aliases:
- the old `.tl-panel { @apply … }` (≈ line 207-209),
- the old `.tl-toolbar { … }` (≈ line 216-218),
- the old `.glass-card { @apply bg-card/80 backdrop-blur-xl … }` in `@layer utilities` (≈ line 479-481),
- the old `.card-glow-primary { … }` (≈ line 300-305) and `.metric-card { … }` (≈ line 339-341).

Keep `.tl-panel-muted`, `.tl-icon-button`, `.metric-label/value/unit`, neon-glow utilities as-is
(they don't conflict with the material; `.tl-icon-button` may optionally gain `glass-bar` later).

- [ ] **Step 5: Run glass test; verify it PASSES**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/design-glass.static.test.ts`
Expected: PASS.

- [ ] **Step 6: Build to prove the CSS compiles**

Run (repo root): `pnpm --filter ./artifacts/trader-dashboard build`
Expected: Vite build succeeds (no CSS parse errors).

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/index.css artifacts/trader-dashboard/src/design-glass.static.test.ts
git commit -m "feat(ui): liquid-glass material tiers + legacy aliases"
```

---

### Task 3: Motion system consolidation

**Files:**
- Modify: `artifacts/trader-dashboard/src/index.css` (`@layer utilities` animation utilities ≈ lines 503-560 and the `card-hover` transition ≈ lines 224-235)
- Create: `artifacts/trader-dashboard/src/design-motion.static.test.ts`

**Interfaces:**
- Consumes: motion tokens from Task 1.
- Produces: animation utilities normalized to the tokens; named vocabulary
  `animate-fade-in-up`, `animate-scale-in`, `animate-float`, `animate-glow-pulse`,
  `animate-border-glow`, `animate-shimmer`, `card-hover` (spring lift).

- [ ] **Step 1: Write the failing motion test**

Create `artifacts/trader-dashboard/src/design-motion.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

// named vocabulary present
for (const cls of [
  "animate-fade-in-up", "animate-scale-in", "animate-float",
  "animate-glow-pulse", "animate-border-glow", "animate-shimmer", "card-hover",
]) {
  assert.match(css, new RegExp(`\\.${cls}[\\s,:{]`), `index.css must define .${cls}`);
}
// motion tokens are actually referenced (not hardcoded everywhere)
assert.match(css, /var\(--ease-glass\)/, "animations should use --ease-glass");
assert.match(css, /var\(--ease-spring\)/, "card-hover should use --ease-spring");
// reduced-motion guard still present
assert.match(css, /prefers-reduced-motion:\s*reduce/, "reduced-motion guard required");

console.log("design motion static checks passed");
```

- [ ] **Step 2: Run it; verify it FAILS**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/design-motion.static.test.ts`
Expected: FAIL (`card-hover should use --ease-spring`).

- [ ] **Step 3: Normalize `card-hover` to the spring token**

In `artifacts/trader-dashboard/src/index.css`, replace the `.card-hover { transition: … }` rule
(≈ lines 224-228) with:

```css
  .card-hover {
    transition: transform var(--dur-base) var(--ease-spring),
                box-shadow var(--dur-base) var(--ease-out),
                border-color var(--dur-base) var(--ease-out);
  }
```

- [ ] **Step 4: Normalize the entrance utilities to `--ease-glass`**

In `@layer utilities`, change `.animate-fade-in-up` and add `.animate-scale-in` so both use the
token easing:

```css
  .animate-fade-in-up {
    animation: fade-in-up var(--dur-slow) var(--ease-glass) both;
  }
  .animate-scale-in {
    animation: scale-in var(--dur-base) var(--ease-glass) both;
  }
```

(The `scale-in` keyframe already exists at the bottom of the file; this just exposes a utility.)

- [ ] **Step 5: Run motion test; verify it PASSES**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/design-motion.static.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add artifacts/trader-dashboard/src/index.css artifacts/trader-dashboard/src/design-motion.static.test.ts
git commit -m "feat(ui): tokenized motion vocabulary (glass/spring easings)"
```

---

### Task 4: Primitive refactor A — Card + Button

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/ui/card.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/button.tsx`
- Create: `artifacts/trader-dashboard/src/components/ui/primitive-a.static.test.ts`

**Interfaces:**
- Consumes: `glass-panel`, `card-hover` (Tasks 2-3); jade `--ring` (Task 1).
- Produces: `<Card>` on `glass-panel`; `buttonVariants` gains a `"glass"` variant; `ButtonProps.variant`
  union extended with `"glass"`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/components/ui/primitive-a.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const card = readFileSync(new URL("./card.tsx", import.meta.url), "utf8");
const button = readFileSync(new URL("./button.tsx", import.meta.url), "utf8");

assert.match(card, /glass-panel/, "Card must use the glass-panel material");
assert.match(card, /card-hover/, "Card must use the card-hover lift");
assert.match(button, /"glass"/, "buttonVariants must add a 'glass' variant");
assert.match(button, /variant\?:[^;]*"glass"/, "ButtonProps.variant union must include 'glass'");

console.log("primitive A static checks passed");
```

- [ ] **Step 2: Run it; verify it FAILS**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/components/ui/primitive-a.static.test.ts`
Expected: FAIL (`Card must use the glass-panel material`).

- [ ] **Step 3: Refactor `card.tsx`**

Replace the `Card` `className` (the `cn(...)` call inside the first `forwardRef`) with:

```tsx
      className={cn(
        "glass-panel card-hover text-card-foreground",
        className
      )}
```

Leave `CardHeader`, `CardTitle`, `CardContent` unchanged.

- [ ] **Step 4: Add the `glass` button variant**

In `artifacts/trader-dashboard/src/components/ui/button.tsx`:

1. Extend the `variant` union in `ButtonProps`:

```tsx
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "glass";
```

2. Add the `glass` entry to the `variants` object inside `buttonVariants`:

```tsx
    glass: "glass-bar text-foreground hover:text-primary hover:border-primary/40",
```

(Keep all other variants. The jade focus ring already comes from `focus-visible:ring-ring`,
which now resolves to jade via Task 1.)

- [ ] **Step 5: Run test; verify it PASSES**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/components/ui/primitive-a.static.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck (variant union change is type-sensitive)**

Run: `pnpm --filter ./artifacts/trader-dashboard typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ui/card.tsx artifacts/trader-dashboard/src/components/ui/button.tsx artifacts/trader-dashboard/src/components/ui/primitive-a.static.test.ts
git commit -m "feat(ui): Card on glass-panel, Button gains glass variant"
```

---

### Task 5: Primitive refactor B — Input / Textarea + Badge

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/ui/input.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/textarea.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/badge.tsx`
- Create: `artifacts/trader-dashboard/src/components/ui/primitive-b.static.test.ts`

**Interfaces:**
- Consumes: `glass-inset` (Task 2), jade `--ring` (Task 1).
- Produces: Input/Textarea fields on `glass-inset` with jade focus ring; Badge variants aligned to
  the existing `.badge-*` token families.

- [ ] **Step 1: Read the three files first**

Read `input.tsx`, `textarea.tsx`, `badge.tsx` to capture their exact current `className` strings
(needed because their content is not pre-pasted here — copy the real strings before editing).

- [ ] **Step 2: Write the failing test**

Create `artifacts/trader-dashboard/src/components/ui/primitive-b.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const input = readFileSync(new URL("./input.tsx", import.meta.url), "utf8");
const textarea = readFileSync(new URL("./textarea.tsx", import.meta.url), "utf8");
const badge = readFileSync(new URL("./badge.tsx", import.meta.url), "utf8");

assert.match(input, /glass-inset/, "Input must use glass-inset well");
assert.match(input, /focus-visible:ring|focus:ring/, "Input must show a focus ring");
assert.match(textarea, /glass-inset/, "Textarea must use glass-inset well");
assert.match(badge, /border/, "Badge keeps bordered pill styling");

console.log("primitive B static checks passed");
```

- [ ] **Step 3: Run it; verify it FAILS**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/components/ui/primitive-b.static.test.ts`
Expected: FAIL (`Input must use glass-inset well`).

- [ ] **Step 4: Refactor Input + Textarea**

In `input.tsx` and `textarea.tsx`, prepend `glass-inset ` to the existing root `className` literal
and ensure the focus ring uses jade. Concretely, replace any existing
`border border-input bg-… ` prefix in the root `cn("…")` with:

```
glass-inset border border-border/60 text-foreground placeholder:text-muted-foreground/50 transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary/50
```

Keep sizing/layout classes (`h-*`, `w-full`, `px-*`, `py-*`, `text-*`, `rounded-*`) intact —
only swap the surface/border/focus portion. (`--ring` is jade after Task 1.)

- [ ] **Step 5: Align Badge variants to token families**

In `badge.tsx`, ensure the variant classes map to the existing `.badge-*` token families from
`index.css` (`bg-success/10 text-success border-success/25`, etc.). If `badge.tsx` already uses
`bg-primary`/`bg-secondary`, update the `default` variant to
`bg-primary/10 text-primary border-primary/25` and `secondary` to
`bg-white/5 text-muted-foreground border-white/10` so badges read as the new jade/neutral pills.
Preserve the exported `Badge` component and `badgeVariants` signature.

- [ ] **Step 6: Run test; verify it PASSES, then typecheck**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/components/ui/primitive-b.static.test.ts`
Expected: PASS.
Run: `pnpm --filter ./artifacts/trader-dashboard typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ui/input.tsx artifacts/trader-dashboard/src/components/ui/textarea.tsx artifacts/trader-dashboard/src/components/ui/badge.tsx artifacts/trader-dashboard/src/components/ui/primitive-b.static.test.ts
git commit -m "feat(ui): Input/Textarea on glass-inset, Badge on token families"
```

---

### Task 6: Primitive refactor C — Overlays (Dialog, Popover, Dropdown, Sheet, Tooltip)

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/ui/dialog.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/popover.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/dropdown-menu.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/sheet.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/tooltip.tsx`
- Create: `artifacts/trader-dashboard/src/components/ui/primitive-c.static.test.ts`

**Interfaces:**
- Consumes: `glass-raised` (Task 2).
- Produces: each overlay content surface rendered on `glass-raised`.
- **Constraint:** `modal.static.test.ts` must stay green — do NOT change z-index ordering or the
  `createPortal`/`document.body` usage in `modal.tsx` (modal.tsx is out of scope here).

- [ ] **Step 1: Read all five files first** to capture exact current `*Content` `className` strings.

- [ ] **Step 2: Write the failing test**

Create `artifacts/trader-dashboard/src/components/ui/primitive-c.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const file of ["dialog", "popover", "dropdown-menu", "sheet", "tooltip"]) {
  const src = readFileSync(new URL(`./${file}.tsx`, import.meta.url), "utf8");
  assert.match(src, /glass-raised/, `${file}.tsx content surface must use glass-raised`);
}

console.log("primitive C static checks passed");
```

- [ ] **Step 3: Run it; verify it FAILS**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/components/ui/primitive-c.static.test.ts`
Expected: FAIL (`dialog.tsx content surface must use glass-raised`).

- [ ] **Step 4: Refactor each content surface**

In each file, find the content component (`DialogContent`, `PopoverContent`,
`DropdownMenuContent`, `SheetContent`, `TooltipContent`) and replace its surface classes
(`bg-popover`/`bg-background`/`border bg-…` + any `shadow-*`) with `glass-raised`, keeping
positioning, animation (`data-[state=…]`), padding, and z-index classes intact. Example for
`DialogContent` — change the `cn("… bg-background … shadow-lg …", className)` to
`cn("… glass-raised …", className)` (drop the now-redundant `bg-*`/`border`/`shadow-*`,
keep `fixed left-1/2 top-1/2 z-50 … p-6 …`).

- [ ] **Step 5: Run new test; verify it PASSES**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/components/ui/primitive-c.static.test.ts`
Expected: PASS.

- [ ] **Step 6: Confirm modal layer test still green + typecheck**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/components/ui/modal.static.test.ts`
Expected: PASS (`modal layer static checks passed`).
Run: `pnpm --filter ./artifacts/trader-dashboard typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ui/dialog.tsx artifacts/trader-dashboard/src/components/ui/popover.tsx artifacts/trader-dashboard/src/components/ui/dropdown-menu.tsx artifacts/trader-dashboard/src/components/ui/sheet.tsx artifacts/trader-dashboard/src/components/ui/tooltip.tsx artifacts/trader-dashboard/src/components/ui/primitive-c.static.test.ts
git commit -m "feat(ui): overlays (dialog/popover/dropdown/sheet/tooltip) on glass-raised"
```

---

### Task 7: Primitive refactor D — Tabs + Separator + Skeleton

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/ui/tabs.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/separator.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/skeleton.tsx`
- Create: `artifacts/trader-dashboard/src/components/ui/primitive-d.static.test.ts`

**Interfaces:**
- Consumes: jade `--primary` (Task 1), `animate-shimmer` (Task 3), `glass-inset` (Task 2).
- Produces: Tabs with a jade active indicator on a glass track; Separator on `border-subtle`;
  Skeleton using `animate-shimmer`.

- [ ] **Step 1: Read the three files first.**

- [ ] **Step 2: Write the failing test**

Create `artifacts/trader-dashboard/src/components/ui/primitive-d.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tabs = readFileSync(new URL("./tabs.tsx", import.meta.url), "utf8");
const skeleton = readFileSync(new URL("./skeleton.tsx", import.meta.url), "utf8");

assert.match(tabs, /data-\[state=active\]/, "Tabs must style the active state");
assert.match(tabs, /glass-inset|bg-surface|bg-secondary/, "Tabs track must use a glass/neutral surface");
assert.match(skeleton, /animate-shimmer/, "Skeleton must use animate-shimmer");

console.log("primitive D static checks passed");
```

- [ ] **Step 3: Run it; verify it FAILS**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/components/ui/primitive-d.static.test.ts`
Expected: FAIL (`Skeleton must use animate-shimmer`).

- [ ] **Step 4: Refactor**

- `tabs.tsx`: give `TabsList` the track surface `glass-inset` (keep its layout/padding), and set
  `TabsTrigger` active state to jade: `data-[state=active]:bg-primary/15
  data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]`
  (preserve existing inactive classes).
- `separator.tsx`: ensure the divider color uses `bg-border` (now `border-subtle`); no structural change.
- `skeleton.tsx`: replace any `animate-pulse bg-*` with `animate-shimmer rounded-md` (keep size props).

- [ ] **Step 5: Run test; verify it PASSES, then typecheck**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/components/ui/primitive-d.static.test.ts`
Expected: PASS.
Run: `pnpm --filter ./artifacts/trader-dashboard typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ui/tabs.tsx artifacts/trader-dashboard/src/components/ui/separator.tsx artifacts/trader-dashboard/src/components/ui/skeleton.tsx artifacts/trader-dashboard/src/components/ui/primitive-d.static.test.ts
git commit -m "feat(ui): Tabs jade active indicator, Skeleton shimmer, Separator neutral"
```

---

### Task 8: `/styleguide` living reference page + route

**Files:**
- Create: `artifacts/trader-dashboard/src/components/ui/styleguide/Styleguide.tsx`
- Modify: `artifacts/trader-dashboard/src/App.tsx` (add import + public route)
- Create: `artifacts/trader-dashboard/src/components/ui/styleguide/styleguide.static.test.ts`

**Interfaces:**
- Consumes: every token, material tier, motion utility, and refactored primitive.
- Produces: a default-exported `Styleguide` React component and a public `/styleguide` route.
- **i18n note:** path under `components/ui/` → exempt from the production-copy guard; section labels
  may be plain literals.

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/components/ui/styleguide/styleguide.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./Styleguide.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../../App.tsx", import.meta.url), "utf8");

assert.match(page, /export default function Styleguide/, "Styleguide must default-export a component");
for (const needle of ["glass-panel", "glass-raised", "glass-inset", "Button", "Card", "Badge"]) {
  assert.match(page, new RegExp(needle), `Styleguide must showcase ${needle}`);
}
assert.match(app, /path="\/styleguide"/, "App.tsx must register the /styleguide route");
assert.match(app, /Styleguide/, "App.tsx must import Styleguide");

console.log("styleguide static checks passed");
```

- [ ] **Step 2: Run it; verify it FAILS**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/components/ui/styleguide/styleguide.static.test.ts`
Expected: FAIL (file not found / no default export).

- [ ] **Step 3: Create the Styleguide component**

Create `artifacts/trader-dashboard/src/components/ui/styleguide/Styleguide.tsx`. It must render
labelled sections for: the neutral ramp swatches (`surface-0..3`, borders, text tiers), the jade
accent + P&L semantic swatches, the four glass tiers (`glass-bar`, `glass-panel`,
`glass-raised`, `glass-inset`) as live cards, the motion utilities (a row of boxes with
`animate-fade-in-up`, `animate-float`, `animate-glow-pulse`, `animate-shimmer`), and a live
gallery of refactored primitives (`Button` in every variant incl. `glass`, `Card`, `Badge`,
`Input`, `Tabs`). Use the real imported primitives from `@/components/ui/*`. Minimal skeleton:

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="section-label">{title}</h2>
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-14 w-20 rounded-md border border-border-subtle"
           style={{ backgroundColor: `hsl(var(${varName}))` }} />
      <span className="text-[10px] text-text-lo">{name}</span>
    </div>
  );
}

export default function Styleguide() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-mono">Design System — Liquid Glass / Neutral Jade</h1>
        <p className="text-text-lo">Single source of truth for tokens, material, motion & primitives.</p>
      </header>

      <Section title="Neutral ramp">
        <Swatch name="surface-0" varName="--surface-0" />
        <Swatch name="surface-1" varName="--surface-1" />
        <Swatch name="surface-2" varName="--surface-2" />
        <Swatch name="surface-3" varName="--surface-3" />
        <Swatch name="border-subtle" varName="--border-subtle" />
        <Swatch name="text-hi" varName="--text-hi" />
        <Swatch name="text-lo" varName="--text-lo" />
      </Section>

      <Section title="Accent & P&L">
        <Swatch name="jade" varName="--accent-jade" />
        <Swatch name="win" varName="--success" />
        <Swatch name="loss" varName="--destructive" />
        <Swatch name="be" varName="--warning" />
      </Section>

      <Section title="Glass tiers">
        <div className="glass-bar h-20 w-40 rounded-lg p-3 text-xs">glass-bar</div>
        <div className="glass-panel h-20 w-40 p-3 text-xs">glass-panel</div>
        <div className="glass-raised h-20 w-40 p-3 text-xs">glass-raised</div>
        <div className="glass-inset h-20 w-40 p-3 text-xs">glass-inset</div>
      </Section>

      <Section title="Motion">
        <div className="glass-panel animate-fade-in-up h-16 w-24 p-2 text-[10px]">fade-in-up</div>
        <div className="glass-panel animate-float h-16 w-24 p-2 text-[10px]">float</div>
        <div className="glass-panel animate-glow-pulse h-16 w-24 p-2 text-[10px]">glow-pulse</div>
        <div className="animate-shimmer h-16 w-24 rounded-md" />
      </Section>

      <Section title="Buttons">
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="glass">Glass</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </Section>

      <Section title="Card / Badge / Input">
        <Card className="w-64">
          <CardHeader>
            <CardTitle>Card title</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-text-lo text-sm">Liquid-glass card body.</p>
            <div className="flex gap-2">
              <Badge>Default</Badge>
            </div>
            <Input placeholder="Glass-inset input" />
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
```

Adjust imports if `Badge`/`Input` export names differ (verify against the real files).

- [ ] **Step 4: Register the public route in `App.tsx`**

Add the import near the other page imports at the top of `App.tsx`:

```tsx
import Styleguide from "@/components/ui/styleguide/Styleguide";
```

Then add the route inside the public `<Switch>` (currently lines 452-458), immediately before
`<Route path="/*?" component={AppShell} />`:

```tsx
          <Route path="/styleguide" component={Styleguide} />
```

- [ ] **Step 5: Run styleguide test; verify it PASSES**

Run: `pnpm --filter ./scripts exec tsx /Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/src/components/ui/styleguide/styleguide.static.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + build**

Run: `pnpm --filter ./artifacts/trader-dashboard typecheck`
Expected: no errors.
Run: `pnpm --filter ./artifacts/trader-dashboard build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ui/styleguide/ artifacts/trader-dashboard/src/App.tsx
git commit -m "feat(ui): /styleguide living reference page"
```

---

### Task 9: Full verification + docs

**Files:**
- Modify: `CLAUDE.md` (§7 Active work — note the design-system foundation)
- Modify: `/Users/gazz/.claude/projects/-Users-gazz-Desktop-TraderLoadingsLOCALE/memory/MEMORY.md` + a new memory file (optional)

- [ ] **Step 1: Run the full gate**

Run (repo root): `pnpm verify`
Expected: install → codegen → typecheck → test → build all pass. If `codegen` reports drift, that
is unrelated to this CSS/UI work — STOP and report rather than committing generated churn.

- [ ] **Step 2: Manual visual check**

Run (repo root): `pnpm --filter ./artifacts/trader-dashboard dev`, open `/styleguide`, and confirm
the four glass tiers, jade accent, P&L colors, motion, and primitives render as intended. Tune
token values in `index.css` only if a contrast/visual issue appears (re-run Task 1 tests after).

- [ ] **Step 3: Update CLAUDE.md §7**

Add a short bullet under §7 noting the new foundation: "Design-system foundation (liquid-glass /
neutral-jade) — tokens + material + motion + core primitives + `/styleguide`; surface rollout
(landing/app/admin) pending." Keep it concise.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note design-system foundation in CLAUDE.md active work"
```

---

## Notes for the executor

- **Aliasing is the safety net.** After Tasks 1-3 land, the whole app should already look refreshed
  with zero consumer edits. If a page looks broken, the cause is almost always an old legacy
  definition still overriding a new alias — check Task 2 Step 4 (deletions) first.
- **Don't touch generated files** (`lib/api-client-react`, `lib/api-zod`) or run `prettier --write`.
- **Per-primitive tasks read the real file first** — current `className` strings are the source of
  truth; the plan shows the target classes, not always the full file.
- **If a `.static.test.ts` you didn't write starts failing**, it's a regression from token/class
  changes — fix the alias, don't weaken the test.
