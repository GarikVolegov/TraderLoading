# Quote Widget Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dashboard quote rotation feel smooth by keeping the card shell stable and animating only the quote content.

**Architecture:** `QuoteWidget` stays as one React component. The data query remains unchanged, while the Framer Motion structure moves `AnimatePresence` from the full card to the inner quote content block.

**Tech Stack:** React, TypeScript, Framer Motion, static Node assertion tests.

---

## File Structure

- Create: `artifacts/trader-dashboard/src/components/QuoteWidget.animation.static.test.ts`
  - Verifies the animation structure in `QuoteWidget.tsx`.
- Modify: `artifacts/trader-dashboard/src/components/QuoteWidget.tsx`
  - Keeps the card shell mounted and animates quote content only.

## Task 1: Add Static Animation Guard

**Files:**
- Create: `artifacts/trader-dashboard/src/components/QuoteWidget.animation.static.test.ts`
- Read: `artifacts/trader-dashboard/src/components/QuoteWidget.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./QuoteWidget.tsx", import.meta.url), "utf8");

assert.doesNotMatch(
  source,
  /<AnimatePresence mode="wait">\s*\{\s*quote\s*\?/s,
  "QuoteWidget should not animate the full card with AnimatePresence mode=\"wait\"",
);

assert.match(
  source,
  /<AnimatePresence initial=\{false\} mode="wait">/,
  "QuoteWidget should animate only quote content after the first quote renders",
);

assert.match(
  source,
  /key=\{\`\$\{quote\.text\}\s*::\s*\$\{quote\.author \?\? ""\}\`\}/,
  "Animated quote content should be keyed by text and author",
);

assert.match(
  source,
  /<div className="relative rounded-2xl border border-border\/30 bg-card\/60 backdrop-blur-sm px-5 py-4 overflow-hidden group hover:border-primary\/25 transition-all duration-300">/,
  "The styled quote card shell should remain a stable non-keyed div",
);

console.log("quote widget animation static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/QuoteWidget.animation.static.test.ts
```

Expected: `FAIL` because `QuoteWidget.tsx` still uses full-card `AnimatePresence mode="wait"` and does not have the inner `AnimatePresence initial={false}` pattern.

## Task 2: Keep Card Shell Stable

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/QuoteWidget.tsx`
- Test: `artifacts/trader-dashboard/src/components/QuoteWidget.animation.static.test.ts`

- [ ] **Step 1: Replace full-card animation with inner content animation**

Use this structure in `QuoteWidget.tsx`:

```tsx
import { motion, AnimatePresence } from "framer-motion";
import { getGetRandomQuoteQueryKey, useGetRandomQuote } from "@workspace/api-client-react";
import { Quote } from "lucide-react";

export function QuoteWidget() {
  const { data: quote } = useGetRandomQuote({
    query: {
      queryKey: getGetRandomQuoteQueryKey(),
      staleTime: 0,
      refetchInterval: 8000,
    },
  });

  if (!quote) {
    return (
      <div className="rounded-2xl border border-border/20 bg-card/40 px-5 py-4">
        <div className="space-y-2">
          <div className="h-3.5 rounded-full bg-secondary/60 animate-shimmer w-full" />
          <div className="h-3.5 rounded-full bg-secondary/60 animate-shimmer w-4/5" />
          <div className="h-2.5 rounded-full bg-secondary/40 animate-shimmer w-24 mt-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm px-5 py-4 overflow-hidden group hover:border-primary/25 transition-all duration-300">
      <Quote
        className="absolute -top-1 left-3 w-12 h-12 text-primary/8 pointer-events-none select-none"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />
      <motion.div
        className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-gradient-to-b from-primary/60 via-primary/20 to-transparent"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      <div className="pl-3 relative z-10">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={`${quote.text} :: ${quote.author ?? ""}`}
            initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-sm sm:text-base italic text-foreground/80 leading-relaxed">
              &ldquo;{quote.text}&rdquo;
            </p>
            {quote.author && (
              <p className="text-xs text-primary/60 mt-2 font-semibold font-mono tracking-wide">
                — {quote.author}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run focused test to verify it passes**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/QuoteWidget.animation.static.test.ts
```

Expected: `quote widget animation static checks passed`.

- [ ] **Step 3: Run dashboard typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: TypeScript exits successfully.

- [ ] **Step 4: Commit implementation files only**

Run:

```bash
git add -- artifacts/trader-dashboard/src/components/QuoteWidget.tsx artifacts/trader-dashboard/src/components/QuoteWidget.animation.static.test.ts docs/superpowers/plans/2026-06-08-quote-widget-animation.md
git commit -m "fix: smooth quote widget animation"
```
