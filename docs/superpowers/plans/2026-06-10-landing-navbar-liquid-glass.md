# Landing Navbar Liquid Glass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the public landing page header into the selected neon liquid-glass floating pill.

**Architecture:** Keep the landing navbar inside `LandingPage.tsx` and change only markup/classes around the existing controls. Add one static test that locks the visual contract without introducing browser-test overhead.

**Tech Stack:** React, Wouter, Framer Motion, Tailwind CSS, Node static assertion tests, pnpm.

---

### Task 1: Static Visual Contract

**Files:**
- Create: `artifacts/trader-dashboard/src/pages/LandingPage.liquid-glass-nav.static.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const landingSource = readFileSync(new URL("./LandingPage.tsx", import.meta.url), "utf8");

assert.match(
  landingSource,
  /rounded-full/,
  "landing navbar shell should be a rounded pill",
);
assert.match(
  landingSource,
  /backdrop-blur-\[30px\]|backdrop-blur-3xl|backdrop-blur-2xl/,
  "landing navbar shell should use a strong frosted glass blur",
);
assert.match(
  landingSource,
  /from-primary\/15/,
  "landing navbar should keep the selected neon liquid green tint",
);
assert.match(
  landingSource,
  /from-blue-500\/10/,
  "landing navbar should include the selected blue liquid tint",
);
assert.match(
  landingSource,
  /bg-\[linear-gradient\(115deg/,
  "landing navbar should include an inner diagonal liquid shine",
);
assert.doesNotMatch(
  landingSource,
  /border-b border-white\/5 backdrop-blur-md bg-background\/50/,
  "landing navbar should not use the old full-width bordered header style",
);

console.log("landing liquid glass nav static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/pages/LandingPage.liquid-glass-nav.static.test.ts`

Expected: FAIL because the landing navbar still uses the old full-width header styling.

### Task 2: Landing Navbar Pill

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/LandingPage.tsx`
- Test: `artifacts/trader-dashboard/src/pages/LandingPage.liquid-glass-nav.static.test.ts`

- [ ] **Step 1: Replace the old header shell with a floating liquid-glass pill**

Change the `<header>` wrapper to provide viewport padding only, then place the existing logo/actions inside a rounded, translucent pill with blur, border, glow, and diagonal shine.

- [ ] **Step 2: Keep controls accessible and responsive**

Preserve the current links, buttons, language select, i18n labels, `setLocation` calls, and responsive visibility rules.

- [ ] **Step 3: Run focused checks**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/pages/LandingPage.liquid-glass-nav.static.test.ts
pnpm --filter @workspace/trader-dashboard typecheck
```

Expected: both commands exit 0.
