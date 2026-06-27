# Landing Product Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead "Guarda la demo" hero button with an in-place, self-playing product tour: tapping it turns the `ProductMock` widget into a 4-scene animated walkthrough that ends on a sign-up CTA.

**Architecture:** A pure playback state machine (`src/lib/landingTour.ts`, unit-tested) drives scene progression. The UI lives in `LandingPage.tsx` matching the existing in-file component pattern: `ProductMock` is refactored into `ProductPreview` (window chrome + idle mock + ▶ overlay) that swaps its body for a `TourPlayer` when a lifted `tourPlaying` state is true. Scenes reuse existing landing visuals (MockSpark, session clock, news-card styling).

**Tech Stack:** React 19, framer-motion (`motion` + `AnimatePresence`), lucide-react, Tailwind 4, custom `node:assert` test runner (run via `pnpm test`), i18n flat key maps in `src/lib/i18n.ts`.

## Global Constraints

- `@typescript-eslint/no-explicit-any` = **error** in non-test source; TS strict mode on.
- All user-facing copy MUST go through `t()` with keys present in **all 5** language blocks (it/en/es/fr/de) in `src/lib/i18n.ts` — `production-copy.static.test.ts` fails the build otherwise. Never pass a string literal to a `title`/`aria-label` that is user-visible.
- Test files use `import assert from "node:assert/strict"` with top-level assertions and `.js` import extensions (NOT vitest `describe/it`). Discovered by `/\.test\.tsx?$/`.
- The gate before "done": `pnpm verify` (install → codegen → typecheck → test → build). Then commit, then `git push`.
- Toolchain may not be on PATH — prefix shell with:
  `export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"`
- Don't `prettier --write` files; match surrounding style by hand.
- Branch: `feat/landing-page-rebuild` (already checked out).

---

### Task 1: Pure playback state machine

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/landingTour.ts`
- Test: `artifacts/trader-dashboard/src/lib/landingTour.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `TOUR_SCENE_COUNT: number` (= 4)
  - `type TourStatus = "playing" | "paused" | "ended"`
  - `interface TourState { index: number; status: TourStatus }`
  - `type TourAction = { type: "tick" } | { type: "next" } | { type: "prev" } | { type: "pause" } | { type: "resume" } | { type: "replay" } | { type: "goto"; index: number }`
  - `const initialTourState: TourState`
  - `function tourReducer(state: TourState, action: TourAction): TourState`

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/lib/landingTour.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  TOUR_SCENE_COUNT,
  initialTourState,
  tourReducer,
  type TourState,
} from "./landingTour.js";

const last = TOUR_SCENE_COUNT - 1;

// initial state
assert.deepEqual(initialTourState, { index: 0, status: "playing" });

// tick advances while playing
assert.deepEqual(tourReducer({ index: 0, status: "playing" }, { type: "tick" }), {
  index: 1,
  status: "playing",
});

// tick past the last scene ends the tour (index clamped to last)
assert.deepEqual(tourReducer({ index: last, status: "playing" }, { type: "tick" }), {
  index: last,
  status: "ended",
});

// tick while paused is a no-op
const paused: TourState = { index: 1, status: "paused" };
assert.deepEqual(tourReducer(paused, { type: "tick" }), paused);

// next from middle advances and forces playing
assert.deepEqual(tourReducer({ index: 1, status: "paused" }, { type: "next" }), {
  index: 2,
  status: "playing",
});

// next from last scene ends; next from ended stays ended
assert.deepEqual(tourReducer({ index: last, status: "playing" }, { type: "next" }), {
  index: last,
  status: "ended",
});
assert.deepEqual(tourReducer({ index: last, status: "ended" }, { type: "next" }), {
  index: last,
  status: "ended",
});

// prev decrements (playing); clamped at 0
assert.deepEqual(tourReducer({ index: 2, status: "paused" }, { type: "prev" }), {
  index: 1,
  status: "playing",
});
assert.deepEqual(tourReducer({ index: 0, status: "playing" }, { type: "prev" }), {
  index: 0,
  status: "playing",
});

// prev from ended re-enters the tour at the last scene, playing
assert.deepEqual(tourReducer({ index: last, status: "ended" }, { type: "prev" }), {
  index: last,
  status: "playing",
});

// pause only from playing
assert.deepEqual(tourReducer({ index: 1, status: "playing" }, { type: "pause" }), {
  index: 1,
  status: "paused",
});
assert.deepEqual(tourReducer({ index: last, status: "ended" }, { type: "pause" }), {
  index: last,
  status: "ended",
});

// resume only from paused
assert.deepEqual(tourReducer({ index: 1, status: "paused" }, { type: "resume" }), {
  index: 1,
  status: "playing",
});
assert.deepEqual(tourReducer({ index: 1, status: "playing" }, { type: "resume" }), {
  index: 1,
  status: "playing",
});

// replay resets from any state, including ended
assert.deepEqual(tourReducer({ index: last, status: "ended" }, { type: "replay" }), {
  index: 0,
  status: "playing",
});

// goto clamps and sets playing
assert.deepEqual(tourReducer({ index: 0, status: "ended" }, { type: "goto", index: 2 }), {
  index: 2,
  status: "playing",
});
assert.deepEqual(tourReducer({ index: 0, status: "playing" }, { type: "goto", index: 99 }), {
  index: last,
  status: "playing",
});
assert.deepEqual(tourReducer({ index: 2, status: "playing" }, { type: "goto", index: -5 }), {
  index: 0,
  status: "playing",
});

console.log("landingTour: all assertions passed");
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd artifacts/trader-dashboard && node --import tsx src/lib/landingTour.test.ts
```
Expected: FAIL — cannot resolve `./landingTour.js` (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `artifacts/trader-dashboard/src/lib/landingTour.ts`:

```ts
export const TOUR_SCENE_COUNT = 4;

export type TourStatus = "playing" | "paused" | "ended";

export interface TourState {
  index: number;
  status: TourStatus;
}

export type TourAction =
  | { type: "tick" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "replay" }
  | { type: "goto"; index: number };

export const initialTourState: TourState = { index: 0, status: "playing" };

const LAST = TOUR_SCENE_COUNT - 1;
const clamp = (i: number): number => Math.max(0, Math.min(LAST, i));

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case "tick":
      if (state.status !== "playing") return state;
      return state.index >= LAST
        ? { index: LAST, status: "ended" }
        : { index: state.index + 1, status: "playing" };
    case "next":
      return state.index >= LAST
        ? { index: LAST, status: "ended" }
        : { index: state.index + 1, status: "playing" };
    case "prev":
      return state.status === "ended"
        ? { index: LAST, status: "playing" }
        : { index: clamp(state.index - 1), status: "playing" };
    case "pause":
      return state.status === "playing" ? { ...state, status: "paused" } : state;
    case "resume":
      return state.status === "paused" ? { ...state, status: "playing" } : state;
    case "replay":
      return { index: 0, status: "playing" };
    case "goto":
      return { index: clamp(action.index), status: "playing" };
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd artifacts/trader-dashboard && node --import tsx src/lib/landingTour.test.ts
```
Expected: PASS — prints `landingTour: all assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/landingTour.ts artifacts/trader-dashboard/src/lib/landingTour.test.ts
git commit -m "feat(landing): add pure product-tour playback state machine"
```

---

### Task 2: i18n keys (all 5 languages)

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/i18n.ts` (5 landing blocks at ~4741 it, ~4863 en, ~4985 es, ~5107 fr, ~5229 de)

**Interfaces:**
- Consumes: nothing.
- Produces: translation keys used by Task 3 & 4 — `landing.tour.cta_button`, `landing.tour.idle_play`, `landing.tour.aria_region`, `landing.tour.ctrl_prev`, `landing.tour.ctrl_next`, `landing.tour.ctrl_pause`, `landing.tour.ctrl_play`, `landing.tour.ctrl_replay`, `landing.tour.ctrl_close`, `landing.tour.s1_title`, `landing.tour.s1_sub`, `landing.tour.s2_title`, `landing.tour.s2_sub`, `landing.tour.s3_title`, `landing.tour.s3_sub`, `landing.tour.s4_title`, `landing.tour.s4_sub`, `landing.tour.end_title`, `landing.tour.end_sub`, `landing.tour.end_cta`. Also revises existing `landing.hero.demo`.

- [ ] **Step 1: Update `landing.hero.demo` value in each language**

Change each existing line:
- it (`~4741`): `"landing.hero.demo": "Guarda il tour",`
- en (`~4863`): `"landing.hero.demo": "Watch the tour",`
- es (`~4985`): `"landing.hero.demo": "Ver el tour",`
- fr (`~5107`): `"landing.hero.demo": "Voir le tour",`
- de (`~5229`): `"landing.hero.demo": "Tour ansehen",`

- [ ] **Step 2: Add the `landing.tour.*` block immediately after each `landing.hero.demo` line**

Italian (after line ~4741):

```ts
    "landing.tour.cta_button": "Guarda il tour",
    "landing.tour.idle_play": "Guarda il tour di 30 secondi",
    "landing.tour.aria_region": "Tour del prodotto",
    "landing.tour.ctrl_prev": "Scena precedente",
    "landing.tour.ctrl_next": "Scena successiva",
    "landing.tour.ctrl_pause": "Pausa",
    "landing.tour.ctrl_play": "Riprendi",
    "landing.tour.ctrl_replay": "Rivedi da capo",
    "landing.tour.ctrl_close": "Chiudi il tour",
    "landing.tour.s1_title": "Registra ogni trade",
    "landing.tour.s1_sub": "Il journal calcola il tuo edge: win-rate, expectancy in R, profit factor.",
    "landing.tour.s2_title": "Resta disciplinato",
    "landing.tour.s2_sub": "Missioni giornaliere, XP e check-in trasformano la costanza in un'abitudine.",
    "landing.tour.s3_title": "Leggi il mercato",
    "landing.tour.s3_sub": "News con impatto e direzione, sintetizzate dall'AI in un colpo d'occhio.",
    "landing.tour.s4_title": "Tutto in tempo reale",
    "landing.tour.s4_sub": "Sincronizza i broker e segui le sessioni live di Londra, New York e Tokyo.",
    "landing.tour.end_title": "Pronto a fare trading con metodo?",
    "landing.tour.end_sub": "Crea il tuo account gratuito in meno di un minuto.",
    "landing.tour.end_cta": "Inizia gratis",
```

English (after the en `landing.hero.demo`):

```ts
    "landing.tour.cta_button": "Watch the tour",
    "landing.tour.idle_play": "Watch the 30-second tour",
    "landing.tour.aria_region": "Product tour",
    "landing.tour.ctrl_prev": "Previous scene",
    "landing.tour.ctrl_next": "Next scene",
    "landing.tour.ctrl_pause": "Pause",
    "landing.tour.ctrl_play": "Resume",
    "landing.tour.ctrl_replay": "Replay from start",
    "landing.tour.ctrl_close": "Close the tour",
    "landing.tour.s1_title": "Log every trade",
    "landing.tour.s1_sub": "Your journal computes your edge: win rate, expectancy in R, profit factor.",
    "landing.tour.s2_title": "Stay disciplined",
    "landing.tour.s2_sub": "Daily missions, XP and check-ins turn consistency into a habit.",
    "landing.tour.s3_title": "Read the market",
    "landing.tour.s3_sub": "News with impact and direction, summarized by AI at a glance.",
    "landing.tour.s4_title": "Everything in real time",
    "landing.tour.s4_sub": "Sync your brokers and follow the live London, New York and Tokyo sessions.",
    "landing.tour.end_title": "Ready to trade with method?",
    "landing.tour.end_sub": "Create your free account in under a minute.",
    "landing.tour.end_cta": "Start free",
```

Spanish (after the es `landing.hero.demo`):

```ts
    "landing.tour.cta_button": "Ver el tour",
    "landing.tour.idle_play": "Ver el tour de 30 segundos",
    "landing.tour.aria_region": "Tour del producto",
    "landing.tour.ctrl_prev": "Escena anterior",
    "landing.tour.ctrl_next": "Escena siguiente",
    "landing.tour.ctrl_pause": "Pausa",
    "landing.tour.ctrl_play": "Reanudar",
    "landing.tour.ctrl_replay": "Volver a ver",
    "landing.tour.ctrl_close": "Cerrar el tour",
    "landing.tour.s1_title": "Registra cada operación",
    "landing.tour.s1_sub": "Tu diario calcula tu edge: tasa de acierto, expectativa en R, profit factor.",
    "landing.tour.s2_title": "Mantén la disciplina",
    "landing.tour.s2_sub": "Misiones diarias, XP y check-ins convierten la constancia en un hábito.",
    "landing.tour.s3_title": "Lee el mercado",
    "landing.tour.s3_sub": "Noticias con impacto y dirección, resumidas por IA de un vistazo.",
    "landing.tour.s4_title": "Todo en tiempo real",
    "landing.tour.s4_sub": "Sincroniza tus brókers y sigue las sesiones en vivo de Londres, Nueva York y Tokio.",
    "landing.tour.end_title": "¿Listo para operar con método?",
    "landing.tour.end_sub": "Crea tu cuenta gratis en menos de un minuto.",
    "landing.tour.end_cta": "Empieza gratis",
```

French (after the fr `landing.hero.demo`):

```ts
    "landing.tour.cta_button": "Voir le tour",
    "landing.tour.idle_play": "Voir le tour de 30 secondes",
    "landing.tour.aria_region": "Tour du produit",
    "landing.tour.ctrl_prev": "Scène précédente",
    "landing.tour.ctrl_next": "Scène suivante",
    "landing.tour.ctrl_pause": "Pause",
    "landing.tour.ctrl_play": "Reprendre",
    "landing.tour.ctrl_replay": "Revoir depuis le début",
    "landing.tour.ctrl_close": "Fermer le tour",
    "landing.tour.s1_title": "Enregistrez chaque trade",
    "landing.tour.s1_sub": "Votre journal calcule votre edge : taux de réussite, expectancy en R, profit factor.",
    "landing.tour.s2_title": "Restez discipliné",
    "landing.tour.s2_sub": "Missions quotidiennes, XP et check-ins transforment la régularité en habitude.",
    "landing.tour.s3_title": "Lisez le marché",
    "landing.tour.s3_sub": "Actualités avec impact et direction, résumées par l'IA en un coup d'œil.",
    "landing.tour.s4_title": "Tout en temps réel",
    "landing.tour.s4_sub": "Synchronisez vos courtiers et suivez les sessions live de Londres, New York et Tokyo.",
    "landing.tour.end_title": "Prêt à trader avec méthode ?",
    "landing.tour.end_sub": "Créez votre compte gratuit en moins d'une minute.",
    "landing.tour.end_cta": "Commencer gratuitement",
```

German (after the de `landing.hero.demo`):

```ts
    "landing.tour.cta_button": "Tour ansehen",
    "landing.tour.idle_play": "30-Sekunden-Tour ansehen",
    "landing.tour.aria_region": "Produkt-Tour",
    "landing.tour.ctrl_prev": "Vorherige Szene",
    "landing.tour.ctrl_next": "Nächste Szene",
    "landing.tour.ctrl_pause": "Pause",
    "landing.tour.ctrl_play": "Fortsetzen",
    "landing.tour.ctrl_replay": "Von vorne ansehen",
    "landing.tour.ctrl_close": "Tour schließen",
    "landing.tour.s1_title": "Jeden Trade festhalten",
    "landing.tour.s1_sub": "Dein Journal berechnet deinen Edge: Trefferquote, Expectancy in R, Profit-Faktor.",
    "landing.tour.s2_title": "Diszipliniert bleiben",
    "landing.tour.s2_sub": "Tägliche Missionen, XP und Check-ins machen Beständigkeit zur Gewohnheit.",
    "landing.tour.s3_title": "Den Markt lesen",
    "landing.tour.s3_sub": "Nachrichten mit Impact und Richtung, von der KI auf einen Blick zusammengefasst.",
    "landing.tour.s4_title": "Alles in Echtzeit",
    "landing.tour.s4_sub": "Verbinde deine Broker und verfolge die Live-Sessions von London, New York und Tokio.",
    "landing.tour.end_title": "Bereit, mit Methode zu traden?",
    "landing.tour.end_sub": "Erstelle dein kostenloses Konto in unter einer Minute.",
    "landing.tour.end_cta": "Kostenlos starten",
```

- [ ] **Step 3: Run the i18n static gate + typecheck**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm test 2>&1 | tail -20
```
Expected: PASS — `production-copy.static.test.ts` green, all keys present in all 5 langs (no missing-key / extra-key failures).

- [ ] **Step 4: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/i18n.ts
git commit -m "feat(landing): add product-tour i18n keys across 5 languages"
```

---

### Task 3: Refactor `ProductMock` → `ProductPreview`, lift state, wire button

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/LandingPage.tsx`

**Interfaces:**
- Consumes: `tourReducer`, `initialTourState` (Task 1); `landing.tour.*` keys (Task 2).
- Produces: `ProductPreview({ playing, onPlay, onExit }: { playing: boolean; onPlay: () => void; onExit: () => void })`; a `TourPlayer` placeholder consumed/replaced in Task 4.

- [ ] **Step 1: Add icon + framer imports**

In the lucide import block (`LandingPage.tsx:5-32`) add `ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X` (keep alphabetical-ish ordering with the rest). Change the framer import on line 3 to:

```ts
import { motion, AnimatePresence } from "framer-motion";
```

- [ ] **Step 2: Lift tour state in `LandingPage` and wire the hero button**

Find the `LandingPage` component function body (the one rendering `<main>` ~line 774). Add near its other `useState` hooks:

```ts
const [tourPlaying, setTourPlaying] = useState(false);
```

Replace the demo button block at `LandingPage.tsx:810-816` with:

```tsx
              <button
                onClick={() => setTourPlaying(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/50 px-6 py-3.5 text-base font-medium text-foreground backdrop-blur-sm transition-colors hover:border-primary/40 sm:w-auto"
              >
                <PlayCircle className="h-[18px] w-[18px]" />
                {t("landing.tour.cta_button")}
              </button>
```

Replace `<ProductMock />` at `LandingPage.tsx:828` with:

```tsx
            <ProductPreview
              playing={tourPlaying}
              onPlay={() => setTourPlaying(true)}
              onExit={() => setTourPlaying(false)}
            />
```

- [ ] **Step 3: Rename `ProductMock` to `ProductPreview` and add idle overlay + body switch**

Rename `function ProductMock()` (`LandingPage.tsx:364`) to:

```tsx
function ProductPreview({
  playing,
  onPlay,
  onExit,
}: {
  playing: boolean;
  onPlay: () => void;
  onExit: () => void;
}) {
```

Keep the existing window-chrome `<div>` (traffic lights + url + Live badge). Wrap the **body** (`<div className="flex flex-col gap-2.5 p-3.5">…</div>`, currently `LandingPage.tsx:389-460`) so that:
- when `playing` → render `<TourPlayer onExit={onExit} />` instead of the mock body;
- when idle → render the existing mock body, plus a play overlay.

Concretely, replace the body `<div className="flex flex-col gap-2.5 p-3.5"> … </div>` with:

```tsx
        {playing ? (
          <TourPlayer onExit={onExit} />
        ) : (
          <div className="relative">
            <div className="flex flex-col gap-2.5 p-3.5">
              {/* …existing idle mock content unchanged… */}
            </div>
            <button
              type="button"
              onClick={onPlay}
              className="group absolute inset-0 flex items-center justify-center bg-background/0 transition-colors hover:bg-background/30"
              aria-label={t("landing.tour.idle_play")}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/80 px-4 py-2 text-[13px] font-semibold text-foreground opacity-0 shadow-[0_0_30px_hsl(var(--primary)/0.25)] backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                <Play className="h-4 w-4 fill-primary text-primary" />
                {t("landing.tour.idle_play")}
              </span>
            </button>
          </div>
        )}
```

(The `{/* …existing idle mock content unchanged… */}` placeholder means: keep the live-clock/session, equity+missions, KPI-row markup that was already inside that `p-3.5` div, verbatim.)

- [ ] **Step 4: Add a temporary `TourPlayer` stub so the file typechecks**

Add above `ProductPreview`:

```tsx
function TourPlayer({ onExit }: { onExit: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">{t("landing.tour.s1_title")}</p>
      <button type="button" onClick={onExit} className="text-xs text-primary underline">
        {t("landing.tour.ctrl_close")}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + build**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm --filter ./artifacts/trader-dashboard typecheck 2>&1 | tail -15
```
Expected: PASS — no TS errors; `ProductMock` no longer referenced; `tourPlaying` flows to `ProductPreview`.

- [ ] **Step 6: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/LandingPage.tsx
git commit -m "refactor(landing): lift tour state, ProductMock -> ProductPreview with play overlay"
```

---

### Task 4: Build the `TourPlayer` (scenes, auto-advance, controls, end-card, a11y)

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/LandingPage.tsx`

**Interfaces:**
- Consumes: `tourReducer`, `initialTourState`, `TOUR_SCENE_COUNT` (Task 1); `landing.tour.*` keys (Task 2); existing helpers `MockSpark`, `TONE`, `SESSION_COLOR`, `getActiveSession`, `useLiveClock` (already in file).
- Produces: final `TourPlayer({ onExit })`.

- [ ] **Step 1: Add the import for the state machine**

Near the other `@/lib` imports in `LandingPage.tsx` (~line 40) add:

```ts
import {
  TOUR_SCENE_COUNT,
  initialTourState,
  tourReducer,
} from "@/lib/landingTour";
```

- [ ] **Step 2: Add a `prefers-reduced-motion` hook (if not already present)**

Add near the other small hooks (e.g. after `useLiveClock`, ~line 335):

```tsx
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}
```

- [ ] **Step 3: Add the four scene components**

Add above `TourPlayer`:

```tsx
const TOUR_SCENE_DURATION_MS = 3400;
const tile = "rounded-xl border border-border/50 bg-secondary/50 px-3 py-2.5";

function TourSceneEdge() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { k: "landing.features.edge.win_rate", v: "64%" },
          { k: "landing.features.edge.expectancy", v: "+0.42R" },
          { k: "landing.features.edge.profit_factor", v: "1.9" },
        ].map((m) => (
          <div key={m.k} className={`${tile} text-center`}>
            <div className="text-[9px] uppercase tracking-[0.07em] text-muted-foreground/80">{t(m.k)}</div>
            <div className="font-mono text-base font-bold" style={{ color: `hsl(${TONE.green})` }}>{m.v}</div>
          </div>
        ))}
      </div>
      <div className={tile}>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground">{"Equity"}</span>
          <span className="font-mono text-[11px] font-bold" style={{ color: `hsl(${TONE.green})` }}>{"+8.6R"}</span>
        </div>
        <MockSpark />
      </div>
    </div>
  );
}

function TourSceneMissions() {
  const { t } = useLanguage();
  return (
    <div className={tile}>
      <div className="mb-2 flex items-center gap-1.5">
        <Target className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-foreground">{t("landing.mock.missions")}</span>
        <span className="ml-auto font-mono text-[10px] font-bold text-primary">{"+75 XP"}</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-300" style={{ width: "72%" }} />
      </div>
      {[
        { k: "landing.mock.journaling", done: false },
        { k: "landing.mock.checkin", done: true },
      ].map((m) => (
        <div
          key={m.k}
          className={`mt-1.5 flex items-center gap-2 text-[12px] ${m.done ? "text-muted-foreground/60" : "text-foreground"}`}
        >
          {m.done ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
          {t(m.k)}
        </div>
      ))}
    </div>
  );
}

function TourSceneNews() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2.5">
        <Newspaper className="h-4 w-4 shrink-0 text-primary" />
        <p className="m-0 line-clamp-2 text-[12.5px] leading-snug text-foreground/90">{t("landing.tour.s3_sub")}</p>
      </div>
      {[
        { impKey: "landing.news.impact.high", dirKey: "landing.news.dir.bull", color: TONE.green, title: "FOMC" },
        { impKey: "landing.news.impact.med", dirKey: "landing.news.dir.bear", color: TONE.red, title: "CPI" },
      ].map((n) => (
        <div key={n.title} className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-card/50 p-3">
          <div className="flex gap-1.5">
            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ color: `hsl(${n.color})`, background: `hsl(${n.color} / 0.12)`, border: `1px solid hsl(${n.color} / 0.3)` }}>
              {n.title}
            </span>
          </div>
          <div className="h-2 w-3/4 rounded bg-muted-foreground/15" />
          <div className="h-2 w-1/2 rounded bg-muted-foreground/10" />
        </div>
      ))}
    </div>
  );
}

function TourSceneLive() {
  const { t } = useLanguage();
  const now = useLiveClock();
  const session = getActiveSession(now);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative flex items-center justify-between overflow-hidden rounded-xl border border-border/50 bg-card/60 px-3 py-2.5">
        <span className="absolute inset-x-0 top-0 h-0.5 bg-primary shadow-[0_0_14px_hsl(var(--primary))]" />
        <span className="font-sans text-[22px] font-bold tabular-nums text-foreground">{format(now, "HH:mm:ss")}</span>
        <span
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold"
          style={{ color: `hsl(${SESSION_COLOR[session]})`, background: `hsl(${SESSION_COLOR[session]} / 0.12)`, borderColor: `hsl(${SESSION_COLOR[session]} / 0.3)` }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: `hsl(${SESSION_COLOR[session]})` }} />
          {t(`landing.session.${session}`)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {["London", "New York", "Tokyo"].map((c) => (
          <div key={c} className={`${tile} text-center`}>
            <div className="mx-auto mb-1 h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: `hsl(${TONE.green})` }} />
            <div className="text-[10px] font-semibold text-muted-foreground">{c}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Note: this uses existing keys `landing.features.edge.*`, `landing.mock.*`, `landing.session.*` (already in i18n). The two `landing.news.*` keys referenced are **placeholders that must exist** — if they are not already in i18n.ts, replace the `impKey`/`dirKey` usages with the static title labels shown (the rendered output here only uses `n.title`, `n.color`, so `impKey`/`dirKey` can be dropped). Drop the unused `impKey`/`dirKey` fields to avoid referencing missing keys.

- [ ] **Step 4: Replace the `TourPlayer` stub with the full implementation**

Replace the `TourPlayer` stub from Task 3 Step 4 with:

```tsx
function TourPlayer({ onExit }: { onExit: () => void }) {
  const { t, language } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const [state, dispatch] = useReducer(tourReducer, initialTourState);

  const scenes = [
    { node: <TourSceneEdge />, title: "landing.tour.s1_title", sub: "landing.tour.s1_sub" },
    { node: <TourSceneMissions />, title: "landing.tour.s2_title", sub: "landing.tour.s2_sub" },
    { node: <TourSceneNews />, title: "landing.tour.s3_title", sub: "landing.tour.s3_sub" },
    { node: <TourSceneLive />, title: "landing.tour.s4_title", sub: "landing.tour.s4_sub" },
  ];

  // auto-advance while playing
  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setTimeout(() => dispatch({ type: "tick" }), TOUR_SCENE_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [state.status, state.index]);

  // Esc exits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const ended = state.status === "ended";
  const scene = scenes[state.index];
  const motionProps = reduced
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className="flex flex-col" role="group" aria-label={t("landing.tour.aria_region")}>
      {/* segmented progress */}
      <div className="flex gap-1 px-3.5 pt-3">
        {Array.from({ length: TOUR_SCENE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => dispatch({ type: "goto", index: i })}
            aria-label={`${t("landing.tour.ctrl_next")} ${i + 1}`}
            className="h-1 flex-1 overflow-hidden rounded-full bg-secondary"
          >
            <span
              className="block h-full rounded-full bg-primary transition-all"
              style={{ width: i < state.index || ended ? "100%" : i === state.index ? "100%" : "0%", opacity: i <= state.index || ended ? 1 : 0.25 }}
            />
          </button>
        ))}
      </div>

      {/* stage */}
      <div className="relative min-h-[228px] p-3.5">
        <AnimatePresence mode="wait">
          {ended ? (
            <motion.div key="end" {...motionProps} className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
              <Rocket className="h-9 w-9 text-primary" />
              <h3 className="font-mono text-lg font-bold text-foreground">{t("landing.tour.end_title")}</h3>
              <p className="max-w-[260px] text-[13px] text-muted-foreground">{t("landing.tour.end_sub")}</p>
              <Link href="/sign-up" className="mt-1 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_0_28px_hsl(var(--primary)/0.34)]">
                {t("landing.tour.end_cta")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ) : (
            <motion.div key={state.index} {...motionProps}>
              {scene.node}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* caption + controls */}
      <div className="border-t border-border/40 px-3.5 py-3">
        {!ended && (
          <div className="mb-2.5 min-h-[44px]">
            <div className="text-[13px] font-bold text-foreground">{t(scene.title)}</div>
            <div className="text-[11.5px] leading-snug text-muted-foreground">{t(scene.sub)}</div>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => dispatch({ type: "prev" })} aria-label={t("landing.tour.ctrl_prev")} className="rounded-lg border border-border/50 p-1.5 text-foreground transition-colors hover:border-primary/40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {ended ? (
            <button type="button" onClick={() => dispatch({ type: "replay" })} aria-label={t("landing.tour.ctrl_replay")} className="rounded-lg border border-border/50 p-1.5 text-foreground transition-colors hover:border-primary/40">
              <RotateCcw className="h-4 w-4" />
            </button>
          ) : state.status === "playing" ? (
            <button type="button" onClick={() => dispatch({ type: "pause" })} aria-label={t("landing.tour.ctrl_pause")} className="rounded-lg border border-border/50 p-1.5 text-foreground transition-colors hover:border-primary/40">
              <Pause className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => dispatch({ type: "resume" })} aria-label={t("landing.tour.ctrl_play")} className="rounded-lg border border-border/50 p-1.5 text-foreground transition-colors hover:border-primary/40">
              <Play className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={() => dispatch({ type: "next" })} aria-label={t("landing.tour.ctrl_next")} className="rounded-lg border border-border/50 p-1.5 text-foreground transition-colors hover:border-primary/40">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={onExit} aria-label={t("landing.tour.ctrl_close")} className="ml-auto rounded-lg border border-border/50 p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

Add `useReducer` to the React import on `LandingPage.tsx:1`:

```ts
import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
```

Also confirm `Link` is imported from `wouter` (it is — `LandingPage.tsx:2`). The `language` destructure is unused — drop it: use `const { t } = useLanguage();`.

- [ ] **Step 5: Typecheck + build**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm --filter ./artifacts/trader-dashboard typecheck 2>&1 | tail -15
```
Expected: PASS — no TS errors, no unused-var/`no-explicit-any` errors.

- [ ] **Step 6: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/LandingPage.tsx
git commit -m "feat(landing): in-place product tour player with 4 scenes + end CTA"
```

---

### Task 5: Full gate + push

**Files:** none (verification only).

- [ ] **Step 1: Run the full gate**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
cd /Users/gazz/Desktop/TraderLoadingsLOCALE && pnpm verify 2>&1 | tail -30
```
Expected: PASS — install, codegen (no diff), typecheck, test (incl. `landingTour.test.ts` + i18n static), build all green.

- [ ] **Step 2: Manual smoke (optional but recommended)**

`pnpm start:local`, open `http://localhost:5173`, click "Guarda il tour" (and hover the widget → ▶). Verify: scenes auto-advance, pause/resume, prev/next, progress bar, Esc/✕ exit back to idle mock, end-card CTA → `/sign-up`. Switch language → all tour copy localized.

- [ ] **Step 3: Push**

```bash
git push
```
Expected: branch `feat/landing-page-rebuild` pushed. If upstream missing: `git push -u origin feat/landing-page-rebuild`. Never `--force`.

---

## Self-Review

**Spec coverage:** trigger button + widget overlay (Task 3) ✓; in-place transform keeping chrome (Task 3) ✓; 4 scenes (Task 4) ✓; auto-advance + pause/prev/next/replay/exit (Tasks 1+4) ✓; end-card CTA (Task 4) ✓; reduced-motion + a11y/Esc (Task 4) ✓; i18n ×5 + button copy (Task 2) ✓; pure tested reducer (Task 1) ✓; verify gate + push (Task 5) ✓.

**Placeholder scan:** the only intentional "keep existing markup" placeholder (Task 3 Step 3) is explicitly defined as "leave the current idle mock body verbatim." Task 4 Step 3 flags the `landing.news.*` keys as not-needed and instructs dropping them so no undefined key is referenced. No other TBD/TODO.

**Type consistency:** `tourReducer`/`initialTourState`/`TOUR_SCENE_COUNT` names identical across Tasks 1, 4. `ProductPreview({ playing, onPlay, onExit })` and `TourPlayer({ onExit })` signatures consistent across Tasks 3, 4. `TourState.status` values `"playing"|"paused"|"ended"` used consistently.
