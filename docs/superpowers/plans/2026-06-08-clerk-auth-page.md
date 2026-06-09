# Clerk Auth Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom TraderLoading authentication page shell around Clerk sign-in and sign-up.

**Architecture:** Keep Clerk as the auth engine and wrap its `SignIn` / `SignUp` components in an app-owned `AuthPageShell`. The shell provides the command-center layout, brand copy, status cards, and responsive composition; Clerk continues to own auth flow state and validation.

**Tech Stack:** React, Vite, Wouter, Clerk React, Tailwind CSS, Node static tests.

---

## File Structure

- Create `artifacts/trader-dashboard/src/components/AuthPageShell.tsx`: reusable presentational shell for sign-in/sign-up pages.
- Modify `artifacts/trader-dashboard/src/App.tsx`: import the shell, wrap `SignIn` and `SignUp`, and tune Clerk `appearance`.
- Create `artifacts/trader-dashboard/src/App.auth.static.test.ts`: static regression test for the shell wiring and Clerk route props.

### Task 1: Auth Static Test

**Files:**
- Create: `artifacts/trader-dashboard/src/App.auth.static.test.ts`
- Read: `artifacts/trader-dashboard/src/App.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const shell = fs.readFileSync("src/components/AuthPageShell.tsx", "utf8");

assert.match(app, /import \{ AuthPageShell \} from "\.\/components\/AuthPageShell"/);
assert.match(app, /<AuthPageShell mode="sign-in">/);
assert.match(app, /<AuthPageShell mode="sign-up">/);
assert.match(app, /<SignIn[\s\S]*routing="path"[\s\S]*path=\{`\$\{basePath\}\/sign-in`\}/);
assert.match(app, /<SignUp[\s\S]*routing="path"[\s\S]*path=\{`\$\{basePath\}\/sign-up`\}/);
assert.match(shell, /type AuthPageShellProps/);
assert.match(shell, /mode: "sign-in" \| "sign-up"/);
assert.match(shell, /TRADER/);
assert.match(shell, /LOADING/);
assert.match(shell, /children/);

console.log("app auth shell static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run from `artifacts/trader-dashboard`:

```bash
pnpm exec tsx src/App.auth.static.test.ts
```

Expected: FAIL because `src/components/AuthPageShell.tsx` does not exist and `App.tsx` does not import/use `AuthPageShell`.

### Task 2: Auth Page Shell

**Files:**
- Create: `artifacts/trader-dashboard/src/components/AuthPageShell.tsx`
- Modify: `artifacts/trader-dashboard/src/App.tsx`
- Test: `artifacts/trader-dashboard/src/App.auth.static.test.ts`

- [ ] **Step 1: Implement the shell**

Create `AuthPageShell` with:

- `mode: "sign-in" | "sign-up"`;
- `children: React.ReactNode`;
- left-side brand, title, supporting copy, and three compact status cards;
- right-side Clerk form panel;
- responsive single-column layout below desktop widths.

- [ ] **Step 2: Wire sign-in and sign-up**

Update `SignInPage` and `SignUpPage` so each renders:

```tsx
<AuthPageShell mode="sign-in">
  <SignIn ... />
</AuthPageShell>
```

and:

```tsx
<AuthPageShell mode="sign-up">
  <SignUp ... />
</AuthPageShell>
```

Keep existing Clerk route props, URLs, and redirects.

- [ ] **Step 3: Tune Clerk appearance**

Update `clerkAppearance` in `App.tsx` so the form uses the app font, tighter panel radius, app green primary color, dark inputs, slate borders, and readable errors.

- [ ] **Step 4: Run the static test**

Run from `artifacts/trader-dashboard`:

```bash
pnpm exec tsx src/App.auth.static.test.ts
```

Expected: PASS with `app auth shell static checks passed`.

### Task 3: Verification

**Files:**
- Verify: `artifacts/trader-dashboard/src/App.tsx`
- Verify: `artifacts/trader-dashboard/src/components/AuthPageShell.tsx`
- Verify: `artifacts/trader-dashboard/src/App.auth.static.test.ts`

- [ ] **Step 1: Run typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard typecheck
```

Expected: PASS.

- [ ] **Step 2: Run build**

Run:

```bash
pnpm --filter @workspace/trader-dashboard build
```

Expected: PASS.

- [ ] **Step 3: Inspect diff**

Run:

```bash
git diff -- artifacts/trader-dashboard/src/App.tsx artifacts/trader-dashboard/src/components/AuthPageShell.tsx artifacts/trader-dashboard/src/App.auth.static.test.ts docs/superpowers/plans/2026-06-08-clerk-auth-page.md
```

Expected: diff only contains the auth shell, auth wiring, test, and plan.
