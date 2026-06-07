# Command Center Pro UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Command Center Pro with coach accents UI/UX redesign for TraderLoadings across mobile and desktop.

**Architecture:** Start with shared, testable design foundations, then apply them through the app shell and the highest-impact pages. The implementation keeps backend/data behavior unchanged and focuses on tokens, shared components, responsive shell ergonomics, dashboard polish, and page-level visual consistency.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS v4, Radix/shadcn-style primitives, framer-motion, lucide-react, node assertion tests through the existing `pnpm run test` runner.

---

## File Structure

- Create: `artifacts/trader-dashboard/src/lib/designSystem.ts`
  - Holds shared Command Center constants for breakpoints, touch targets, radii, semantic hues, and page verification viewports.
- Test: `artifacts/trader-dashboard/src/lib/designSystem.test.ts`
  - Verifies design tokens used by implementation meet the approved UX invariants.
- Modify: `artifacts/trader-dashboard/src/index.css`
  - Updates global fonts, color tokens, radius tokens, base interaction states, reduced motion, utility classes, panel classes, metric classes, and mobile overflow guardrails.
- Modify: `artifacts/trader-dashboard/src/components/ui/card.tsx`
  - Makes cards stricter, less rounded, lower-shadow, and more operational.
- Modify: `artifacts/trader-dashboard/src/components/ui/button.tsx`
  - Standardizes touch target sizes, focus, loading, radius, and semantic variants.
- Modify: `artifacts/trader-dashboard/src/components/ui/input.tsx`
  - Aligns form controls with 44px+ touch targets and mono numeric feel.
- Modify: `artifacts/trader-dashboard/src/components/ui/tabs.tsx`
  - Adds responsive, scroll-safe, accessible tab sizing.
- Modify: `artifacts/trader-dashboard/src/components/ui/skeleton.tsx`
  - Uses stable low-contrast loading surfaces.
- Modify: `artifacts/trader-dashboard/src/components/PageLayout.tsx`
  - Tightens global shell spacing, safe-area behavior, and background treatment.
- Modify: `artifacts/trader-dashboard/src/components/PageHeader.tsx`
  - Makes page headers denser and less hero-like.
- Modify: `artifacts/trader-dashboard/src/components/TopNav.tsx`
  - Improves top chrome touch targets, labels, and command-center density.
- Modify: `artifacts/trader-dashboard/src/components/BottomNav.tsx`
  - Improves mobile nav touch ergonomics and desktop sidebar polish.
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx`
  - Replaces normal-mode masonry with a predictable responsive command grid and improves widget chrome.
- Modify: `artifacts/trader-dashboard/src/pages/Broker.tsx`
  - Frames Broker Hub as a trustworthy operational workspace.
- Modify: `artifacts/trader-dashboard/src/pages/Tools.tsx`
  - Tightens tabs and tool workspace containment.
- Modify: `artifacts/trader-dashboard/src/pages/News.tsx`
  - Improves news scanning, source/freshness hierarchy, and loading/empty states.

## Task 1: Design Tokens and Static UX Invariants

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/designSystem.ts`
- Test: `artifacts/trader-dashboard/src/lib/designSystem.test.ts`

- [ ] **Step 1: Write the failing token test**

Create `artifacts/trader-dashboard/src/lib/designSystem.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  commandCenterPalette,
  commandCenterRadii,
  commandCenterTouch,
  commandCenterViewports,
} from "./designSystem.js";

assert.equal(commandCenterTouch.minTargetPx, 44);
assert.equal(commandCenterTouch.minGapPx, 8);

assert.deepEqual(commandCenterViewports, [375, 768, 1024, 1440]);

assert.equal(commandCenterRadii.panelPx <= 12, true);
assert.equal(commandCenterRadii.modalPx <= 16, true);

assert.equal(commandCenterPalette.background, "#020617");
assert.equal(commandCenterPalette.accent, "#22C55E");
assert.equal(commandCenterPalette.foreground, "#F8FAFC");

console.log("command center design token checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm run test -- artifacts/trader-dashboard/src/lib/designSystem.test.ts
```

Expected: FAIL because `./designSystem.js` cannot be resolved.

- [ ] **Step 3: Implement the design token module**

Create `artifacts/trader-dashboard/src/lib/designSystem.ts`:

```ts
export const commandCenterPalette = {
  background: "#020617",
  card: "#0E1223",
  panel: "#1A1E2F",
  border: "#334155",
  foreground: "#F8FAFC",
  mutedForeground: "#94A3B8",
  accent: "#22C55E",
  destructive: "#EF4444",
  warning: "#F59E0B",
} as const;

export const commandCenterTouch = {
  minTargetPx: 44,
  minGapPx: 8,
} as const;

export const commandCenterRadii = {
  controlPx: 8,
  panelPx: 10,
  modalPx: 16,
} as const;

export const commandCenterViewports = [375, 768, 1024, 1440] as const;
```

- [ ] **Step 4: Run the token test**

Run:

```bash
pnpm run test -- artifacts/trader-dashboard/src/lib/designSystem.test.ts
```

Expected: PASS with `command center design token checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/designSystem.ts artifacts/trader-dashboard/src/lib/designSystem.test.ts
git commit -m "test: add command center design tokens"
```

## Task 2: Global Command Center CSS Foundation

**Files:**
- Modify: `artifacts/trader-dashboard/src/index.css`

- [ ] **Step 1: Write the failing CSS invariant check**

Run:

```powershell
Select-String -Path artifacts\trader-dashboard\src\index.css -Pattern "Fira Sans|Fira Code|--tl-surface-panel|touch-action: manipulation|prefers-reduced-motion"
```

Expected: output is missing at least `Fira Sans`, `Fira Code`, `--tl-surface-panel`, and `prefers-reduced-motion`.

- [ ] **Step 2: Update font import and theme font tokens**

In `artifacts/trader-dashboard/src/index.css`, replace the Google Fonts import with:

```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@400;500;600;700&display=swap');
```

In the `@theme inline` block, set:

```css
  --font-sans: 'Fira Sans', sans-serif;
  --font-mono: 'Fira Code', monospace;
```

- [ ] **Step 3: Update global color and radius tokens**

In the `:root` block, replace the current color/radius values with:

```css
  --background: 222 47% 3%;
  --foreground: 210 40% 98%;

  --card: 226 43% 10%;
  --card-foreground: 210 40% 98%;

  --popover: 226 43% 8%;
  --popover-foreground: 210 40% 98%;

  --primary: 142 71% 45%;
  --primary-foreground: 222 47% 6%;

  --secondary: 222 35% 14%;
  --secondary-foreground: 210 40% 98%;

  --muted: 225 28% 14%;
  --muted-foreground: 215 20% 65%;

  --accent: 217 91% 60%;
  --accent-foreground: 210 40% 98%;

  --destructive: 0 84% 60%;
  --destructive-foreground: 210 40% 98%;

  --success: 142 71% 45%;
  --success-foreground: 222 47% 6%;

  --warning: 38 92% 50%;
  --warning-foreground: 222 47% 6%;

  --border: 215 25% 27%;
  --input: 215 25% 24%;
  --ring: 142 71% 45%;

  --tl-surface-panel: 226 43% 10%;
  --tl-surface-raised: 224 32% 14%;
  --tl-border-strong: 215 25% 32%;
  --tl-shadow-panel: 0 10px 30px rgba(0, 0, 0, 0.28);

  --radius: 0.625rem;
```

- [ ] **Step 4: Replace decorative body background with restrained command texture**

In the `body` rule, replace the `background-image` value with:

```css
    background-image:
      linear-gradient(180deg, hsl(var(--background)) 0%, hsl(224 55% 5%) 100%),
      radial-gradient(ellipse 70% 45% at 85% -10%, hsl(var(--primary) / 0.055) 0%, transparent 55%),
      linear-gradient(hsl(var(--border) / 0.035) 1px, transparent 1px),
      linear-gradient(90deg, hsl(var(--border) / 0.025) 1px, transparent 1px);
    background-size: auto, auto, 48px 48px, 48px 48px;
```

- [ ] **Step 5: Add global touch and reduced-motion rules**

In `@layer base`, after the `html` rule, add:

```css
  html,
  body {
    overflow-x: hidden;
  }

  body {
    touch-action: manipulation;
  }
```

At the end of `@layer base`, add:

```css
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.001ms !important;
    }
  }
```

- [ ] **Step 6: Add shared panel utilities**

In `@layer components`, before `.card-hover`, add:

```css
  .tl-panel {
    @apply rounded-[0.625rem] border border-border/45 bg-card/72 text-card-foreground shadow-[var(--tl-shadow-panel)] backdrop-blur-md;
  }

  .tl-panel-muted {
    @apply rounded-[0.625rem] border border-border/35 bg-secondary/38 text-card-foreground;
  }

  .tl-toolbar {
    @apply flex flex-wrap items-center gap-2 rounded-[0.625rem] border border-border/40 bg-card/55 px-3 py-2;
  }

  .tl-icon-button {
    @apply inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border/50 bg-card/65 text-muted-foreground transition-colors hover:border-primary/45 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-45;
  }
```

- [ ] **Step 7: Run CSS invariant check**

Run:

```powershell
Select-String -Path artifacts\trader-dashboard\src\index.css -Pattern "Fira Sans|Fira Code|--tl-surface-panel|touch-action: manipulation|prefers-reduced-motion|tl-panel|tl-icon-button"
```

Expected: all patterns are present.

- [ ] **Step 8: Run typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add artifacts/trader-dashboard/src/index.css
git commit -m "style: add command center css foundation"
```

## Task 3: Shared Components Polish

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/ui/card.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/button.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/input.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/tabs.tsx`
- Modify: `artifacts/trader-dashboard/src/components/ui/skeleton.tsx`

- [ ] **Step 1: Write static component checks**

Run:

```powershell
Select-String -Path artifacts\trader-dashboard\src\components\ui\*.tsx -Pattern "rounded-2xl|hover:-translate-y|h-9 rounded-lg|bg-primary/10"
```

Expected: finds old overly-soft or inconsistent component classes in `card.tsx`, `button.tsx`, `tabs.tsx`, and `skeleton.tsx`.

- [ ] **Step 2: Update Card classes**

In `artifacts/trader-dashboard/src/components/ui/card.tsx`, replace the `Card` class list with:

```tsx
        "rounded-[0.625rem] border border-border/45 bg-card/72 text-card-foreground shadow-[var(--tl-shadow-panel)] backdrop-blur-md",
        "transition-colors duration-200 hover:border-border/75",
```

Replace `CardHeader` class with:

```tsx
cn("flex flex-col space-y-1 p-4 sm:p-5", className)
```

Replace `CardTitle` class with:

```tsx
cn("text-base font-mono font-semibold leading-tight", className)
```

Replace `CardContent` class with:

```tsx
cn("p-4 pt-0 sm:p-5 sm:pt-0", className)
```

- [ ] **Step 3: Update Button variants**

In `artifacts/trader-dashboard/src/components/ui/button.tsx`, replace `baseStyles`, `variants`, and `sizes` with:

```ts
  const baseStyles = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]";
  const variants = {
    default: "bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.16),0_10px_22px_hsl(var(--primary)/0.12)] hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground shadow-[0_0_0_1px_hsl(var(--destructive)/0.16)] hover:bg-destructive/90",
    outline: "border border-border/60 bg-card/50 text-foreground hover:border-primary/45 hover:text-primary",
    secondary: "bg-secondary/80 text-secondary-foreground hover:bg-secondary",
    ghost: "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
    link: "min-h-0 rounded-none px-0 text-primary underline-offset-4 hover:underline",
  };
  const sizes = {
    default: "px-4 py-2 text-sm",
    sm: "min-h-10 rounded-md px-3 text-xs",
    lg: "min-h-12 px-6 text-base",
    icon: "h-11 w-11 p-0",
  };
```

In the loading icon render, replace `mr-2` with no margin:

```tsx
{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
```

- [ ] **Step 4: Update Input sizing**

In `artifacts/trader-dashboard/src/components/ui/input.tsx`, replace the input class with:

```tsx
            "flex min-h-11 w-full rounded-lg border border-input bg-secondary/55 px-3.5 py-2 text-sm font-mono text-foreground transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:border-primary/70 disabled:cursor-not-allowed disabled:opacity-45",
```

- [ ] **Step 5: Update Tabs and Skeleton classes**

In `artifacts/trader-dashboard/src/components/ui/tabs.tsx`, replace `TabsList` class with:

```tsx
      "flex min-h-11 w-full gap-1 overflow-x-auto rounded-lg border border-border/45 bg-card/55 p-1",
```

Replace `TabsTrigger` class with:

```tsx
      "flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-sm",
```

In `artifacts/trader-dashboard/src/components/ui/skeleton.tsx`, replace the class with:

```tsx
cn("animate-pulse rounded-lg bg-secondary/50", className)
```

- [ ] **Step 6: Run component checks**

Run:

```powershell
Select-String -Path artifacts\trader-dashboard\src\components\ui\card.tsx,artifacts\trader-dashboard\src\components\ui\button.tsx,artifacts\trader-dashboard\src\components\ui\input.tsx,artifacts\trader-dashboard\src\components\ui\tabs.tsx,artifacts\trader-dashboard\src\components\ui\skeleton.tsx -Pattern "rounded-2xl|hover:-translate-y|h-9 rounded-lg|bg-primary/10"
```

Expected: no output for these five files.

- [ ] **Step 7: Run typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ui/card.tsx artifacts/trader-dashboard/src/components/ui/button.tsx artifacts/trader-dashboard/src/components/ui/input.tsx artifacts/trader-dashboard/src/components/ui/tabs.tsx artifacts/trader-dashboard/src/components/ui/skeleton.tsx
git commit -m "style: polish shared command center components"
```

## Task 4: Responsive App Shell and Navigation

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/PageLayout.tsx`
- Modify: `artifacts/trader-dashboard/src/components/PageHeader.tsx`
- Modify: `artifacts/trader-dashboard/src/components/TopNav.tsx`
- Modify: `artifacts/trader-dashboard/src/components/BottomNav.tsx`

- [ ] **Step 1: Write static shell checks**

Run:

```powershell
Select-String -Path artifacts\trader-dashboard\src\components\PageLayout.tsx,artifacts\trader-dashboard\src\components\PageHeader.tsx,artifacts\trader-dashboard\src\components\TopNav.tsx,artifacts\trader-dashboard\src\components\BottomNav.tsx -Pattern "w-8 h-8|h-8 w-8|rounded-2xl|text-3xl|pt-\\[3rem\\]"
```

Expected: finds old compact controls and oversized header styling.

- [ ] **Step 2: Update PageLayout spacing**

In `PageLayout.tsx`, change the outer wrapper class to:

```tsx
    <div className="relative min-h-screen overflow-x-hidden bg-background pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-6 lg:pl-20">
```

Change the default background image class to:

```tsx
className="h-full w-full object-cover opacity-[0.1] mix-blend-screen"
```

Change the content wrapper class template to:

```tsx
        className={`relative z-10 ${
          fullWidth ? "w-full" : "mx-auto max-w-[1760px]"
        } space-y-3 px-3 pt-[3.85rem] sm:space-y-4 sm:px-5 lg:px-5 lg:pt-[3.65rem] xl:px-7`}
```

- [ ] **Step 3: Update PageHeader density**

In `PageHeader.tsx`, change the root class to:

```tsx
      className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-end sm:justify-between"
```

Change the accent bar class to:

```tsx
          className="mt-0.5 h-8 w-0.5 shrink-0 rounded-full bg-primary sm:h-9"
```

Change the title class to:

```tsx
              className="text-xl font-bold leading-tight sm:text-2xl lg:text-[1.65rem]"
```

Change the subtitle class to:

```tsx
              className="mt-1 max-w-3xl text-sm leading-snug text-muted-foreground"
```

- [ ] **Step 4: Update TopNav touch targets and labels**

In `TopNav.tsx`, remove unused `Bell` from the lucide import.

Change the top inner wrapper class to:

```tsx
          <div className="mx-auto flex h-14 max-w-[1760px] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-5 xl:px-7">
```

For the audio button, add `aria-label`, `type`, and 44px class:

```tsx
              type="button"
              aria-label={isPlaying ? "Disattiva audio focus" : "Attiva audio focus"}
              className={`flex h-11 w-11 items-center justify-center rounded-lg border transition-colors ${
```

Change audio icons to `h-4 w-4`.

For the settings link, add `aria-label="Apri impostazioni"` and change class to:

```tsx
className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/55 bg-card/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
```

Change the UserButton avatar class to `h-11 w-11 rounded-lg border border-border/60`.

- [ ] **Step 5: Update BottomNav mobile and desktop targets**

In `BottomNav.tsx`, change compact desktop link class from `h-11 w-11` to:

```tsx
className={`group relative mx-auto flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-200 ${
```

Change mobile link class to:

```tsx
className="relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 py-2"
```

Change desktop sidebar logo box from `rounded-2xl` to `rounded-lg`.

Change desktop sidebar nav class to:

```tsx
className="fixed bottom-0 left-0 top-0 z-50 hidden w-20 flex-col border-r border-border/45 bg-card/90 shadow-[2px_0_24px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:flex"
```

- [ ] **Step 6: Run shell checks**

Run:

```powershell
Select-String -Path artifacts\trader-dashboard\src\components\PageLayout.tsx,artifacts\trader-dashboard\src\components\PageHeader.tsx,artifacts\trader-dashboard\src\components\TopNav.tsx,artifacts\trader-dashboard\src\components\BottomNav.tsx -Pattern "w-8 h-8|h-8 w-8|rounded-2xl|text-3xl|pt-\\[3rem\\]"
```

Expected: no output for the targeted shell files.

- [ ] **Step 7: Run typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add artifacts/trader-dashboard/src/components/PageLayout.tsx artifacts/trader-dashboard/src/components/PageHeader.tsx artifacts/trader-dashboard/src/components/TopNav.tsx artifacts/trader-dashboard/src/components/BottomNav.tsx
git commit -m "style: refine command center shell"
```

## Task 5: Dashboard Command Grid and Widget Chrome

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx`
- Modify: `artifacts/trader-dashboard/src/index.css`

- [ ] **Step 1: Write dashboard invariant check**

Run:

```powershell
Select-String -Path artifacts\trader-dashboard\src\pages\Dashboard.tsx -Pattern "columns-1|rounded-\\[1rem\\]|w-6 h-6|h-\\[200px\\]"
```

Expected: finds the old masonry layout, 1rem widget shells, small edit controls, and fixed edit height.

- [ ] **Step 2: Replace dashboard layout class calculation**

In `Dashboard.tsx`, replace `containerClass` with:

```ts
  const containerClass = isEditing
    ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    : "dashboard-command-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12";
```

Add this helper before `return`:

```ts
  const getWidgetSpanClass = (id: string) => {
    if (isEditing) return "min-h-[13rem]";
    if (id === "checklist" || id === "calendar") return "xl:col-span-6";
    if (id === "clock" || id === "account" || id === "routine") return "xl:col-span-4";
    return "xl:col-span-3";
  };
```

Change the mapped widget wrapper class from:

```tsx
className={isEditing ? "h-[200px]" : "mb-4 break-inside-avoid"}
```

to:

```tsx
className={getWidgetSpanClass(id)}
```

- [ ] **Step 3: Tighten widget shell and edit controls**

In `Dashboard.tsx`, replace `rounded-[1rem]` occurrences in widget shell/edit overlays with `rounded-[0.625rem]`.

Change the widget shell inline style to:

```tsx
style={{ borderRadius: "0.625rem" }}
```

Change the eye toggle button class from `w-6 h-6 rounded-md` to:

```tsx
className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
```

Change the open affordance `style` dimensions from `1.75rem` to:

```tsx
style={{ height: "2.25rem", width: "2.25rem" }}
```

- [ ] **Step 4: Update dashboard CSS helpers**

In `index.css`, update `.dashboard-command-grid` to:

```css
  .dashboard-command-grid {
    align-items: start;
    grid-auto-flow: dense;
  }
```

Replace `.dashboard-widget-shell :is(.rounded-2xl, .rounded-\[1rem\])` rule with:

```css
  .dashboard-widget-shell :is(.rounded-2xl, .rounded-\[1rem\], .rounded-xl) {
    border-radius: 0.625rem;
  }
```

- [ ] **Step 5: Run dashboard invariant check**

Run:

```powershell
Select-String -Path artifacts\trader-dashboard\src\pages\Dashboard.tsx -Pattern "columns-1|rounded-\\[1rem\\]|w-6 h-6|h-\\[200px\\]"
```

Expected: no output.

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/Dashboard.tsx artifacts/trader-dashboard/src/index.css
git commit -m "style: convert dashboard to command grid"
```

## Task 6: Broker, Tools, and News High-Impact Polish

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Broker.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Tools.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/News.tsx`

- [ ] **Step 1: Write page polish check**

Run:

```powershell
Select-String -Path artifacts\trader-dashboard\src\pages\Broker.tsx,artifacts\trader-dashboard\src\pages\Tools.tsx,artifacts\trader-dashboard\src\pages\News.tsx -Pattern "rounded-2xl|bg-card/40|bg-card/50|h-48 rounded-2xl|md:w-1/4|md:w-3/4"
```

Expected: finds old page-specific soft card and split-width classes.

- [ ] **Step 2: Refine Broker wrapper**

In `Broker.tsx`, change the page header icon wrapper class to:

```tsx
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
```

Wrap the `CloudAccountConnect` and `details` section in:

```tsx
      <section className="grid gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(22rem,0.42fr)]">
        <div className="min-w-0">
          <CloudAccountConnect />
        </div>
        <details className="tl-panel overflow-hidden">
          <summary className="flex min-h-11 cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
            <Settings2 className="h-4 w-4" /> Opzioni avanzate
          </summary>
          <div className="border-t border-border/40 p-4">
            <BrokerHubWorkspace initialTab={getInitialBrokerTab()} />
          </div>
        </details>
      </section>
```

Remove the previous standalone `<CloudAccountConnect />` and old `details` block.

- [ ] **Step 3: Refine Tools layout**

In `Tools.tsx`, change the tab/workspace container class to:

```tsx
        <div className="grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
```

Change `TabsList` class to:

```tsx
className="h-auto w-full self-start overflow-x-auto lg:flex-col lg:overflow-visible"
```

Change each `TabsTrigger` class to:

```tsx
className="min-w-[8rem] flex-1 justify-center lg:min-w-0 lg:w-full lg:justify-start"
```

Change the `Card` wrapper from `className="md:w-3/4"` to:

```tsx
className="min-w-0"
```

- [ ] **Step 4: Refine News panels and skeletons**

In `News.tsx`, change the agent summary panel class to:

```tsx
            className="tl-panel flex gap-3 border-primary/20 bg-primary/5 p-4"
```

Change news skeleton class from:

```tsx
className="h-48 rounded-2xl animate-pulse bg-white/5 border border-white/5"
```

to:

```tsx
className="h-48 animate-pulse rounded-lg border border-border/30 bg-secondary/40"
```

Change empty `Card` class to:

```tsx
className="border-border/40 bg-card/70"
```

Change `ArticleCard` Card class to:

```tsx
className="flex h-full cursor-pointer flex-col overflow-hidden border-border/35 bg-card/70 transition-colors duration-200 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
```

- [ ] **Step 5: Run page polish check**

Run:

```powershell
Select-String -Path artifacts\trader-dashboard\src\pages\Broker.tsx,artifacts\trader-dashboard\src\pages\Tools.tsx,artifacts\trader-dashboard\src\pages\News.tsx -Pattern "rounded-2xl|bg-card/40|bg-card/50|h-48 rounded-2xl|md:w-1/4|md:w-3/4"
```

Expected: no output in these three page files.

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/Broker.tsx artifacts/trader-dashboard/src/pages/Tools.tsx artifacts/trader-dashboard/src/pages/News.tsx
git commit -m "style: polish broker tools and news workspaces"
```

## Task 7: Full Verification and Browser Review

**Files:**
- No source edits expected unless verification finds defects.

- [ ] **Step 1: Run token and type verification**

Run:

```bash
pnpm run test -- artifacts/trader-dashboard/src/lib/designSystem.test.ts
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: both commands PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run build
```

Expected: PASS and Vite emits the production bundle.

- [ ] **Step 3: Start local runtime**

Run:

```bash
pnpm run start:local
```

Expected: frontend is available at `http://localhost:5173` and backend remains available at `http://localhost:3001`. If a server is already running on these ports, use the running server and do not start a duplicate.

- [ ] **Step 4: Capture browser screenshots**

Use browser automation or Playwright-equivalent screenshots at:

```text
http://localhost:5173/
http://localhost:5173/broker
http://localhost:5173/tools
http://localhost:5173/news
```

For each route, capture these viewport widths:

```text
375x812
768x1024
1024x768
1440x900
```

Expected visual checks:

- No horizontal mobile scroll.
- No incoherent overlap between top nav, bottom nav, content, and panels.
- Touch targets in nav and primary controls are visually at least 44px.
- Dashboard grid is predictable on desktop and stacked cleanly on mobile.
- Broker, Tools, and News use the same panel rhythm as the shell.
- Focus rings are visible when tabbing through icon-only controls.

- [ ] **Step 5: Verify reduced motion**

In the browser, emulate `prefers-reduced-motion: reduce` and refresh `/`, `/tools`, and `/news`.

Expected: content remains usable, animations do not block interaction, and no layout jumps appear from disabled transitions.

- [ ] **Step 6: Run runtime smoke if the local environment is healthy**

Run:

```bash
pnpm run smoke:runtime
```

Expected: PASS. If it fails because of a pre-existing unrelated backend, auth, Docker, or environment issue, capture the failing command output and continue with the browser evidence from Step 4.

- [ ] **Step 7: Final commit for verification-only fixes**

If verification required small source fixes, commit them:

```bash
git add artifacts/trader-dashboard/src
git commit -m "fix: resolve command center visual verification issues"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: Tasks 1-3 cover visual system, color, typography, shape, interaction states, and shared components. Task 4 covers desktop/mobile shell, safe areas, touch targets, and navigation. Task 5 covers dashboard hierarchy and responsive grid. Task 6 covers Broker, Tools, and News page priorities. Task 7 covers typecheck, build, browser viewport verification, reduced motion, and runtime smoke.
- Placeholder scan: no banned placeholder phrases remain in actionable steps.
- Type consistency: token names in `designSystem.test.ts` match `designSystem.ts`; component file paths match existing files; commands target the current pnpm workspace.
