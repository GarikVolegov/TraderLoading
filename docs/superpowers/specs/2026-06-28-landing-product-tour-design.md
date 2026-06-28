# Landing Product Tour — Design

**Date:** 2026-06-28
**Branch:** `feat/landing-page-rebuild`
**Status:** Approved (brainstorm)

## Problem

The landing-page hero has a secondary CTA labelled **"Guarda la demo"**
([`LandingPage.tsx`](../../../artifacts/trader-dashboard/src/pages/LandingPage.tsx)).
It currently just navigates to `/sign-in` — it does **not** show any demo, so it
means nothing to a first-time visitor. We want the button to actually *demonstrate*
the product.

There is no recorded video in the repo, and we cannot record/edit a real screencast
in this environment. The chosen solution is a **self-playing animated product tour
built in code**, reusing the visuals already present on the landing page.

## Decision (chosen approach)

Tapping the hero button turns the existing `ProductMock` widget (the fake animated
app preview, shown beside the hero on desktop / below on mobile) into **"tour mode"
in-place**: it auto-plays through 4 scenes that simulate real usage, then shows an
end-card with a sign-up CTA. The tour starts **only on user action** (button tap or
tapping the widget) — no autoplay on first load.

Rejected alternatives: real `<video>` / YouTube embed (no asset, can't produce one);
full-screen modal (drifts from the "the preview itself becomes the demo" idea the
user asked for).

## Scope

### In scope
- Hero button becomes the tour trigger; the widget itself also triggers it (idle
  "play" overlay).
- 4 auto-advancing scenes + end-card with CTA.
- In-place transformation of the widget (keeps the window chrome).
- Controls: prev / next, pause / resume, replay, exit (back to idle mock).
- `prefers-reduced-motion` support; basic a11y (labels, Esc to exit).
- i18n for all new copy across all 5 languages; button copy updated.

### Out of scope (YAGNI)
- Real recorded/edited video (explicitly cannot be produced here).
- Autoplay on first visit / localStorage gating.
- Sound/voiceover.
- Analytics events for tour engagement.

## Architecture

### State
A single piece of state lifted into the `LandingPage` component body, where both the
hero button and the widget already render:

```ts
const [tourPlaying, setTourPlaying] = useState(false);
```

- Hero button `onClick` → `setTourPlaying(true)`.
- Widget idle "play" overlay → `setTourPlaying(true)`.
- Tour exit (✕ / Esc / end-card "close") → `setTourPlaying(false)`.

### Components (all in `LandingPage.tsx`, matching the existing in-file pattern)
- **`ProductPreview`** — refactor of today's `ProductMock`. Always renders the
  "window" frame (traffic-light dots, `app.traderloading.com`, *Live* badge). Body:
  - **idle** → the current mock body (clock+session, equity spark, missions, KPIs)
    plus a subtle overlay with a ▶ "Guarda il tour" affordance.
  - **playing** → `TourPlayer`.
- **`TourPlayer`** — crossfades between scenes via framer-motion `AnimatePresence`,
  shows the active scene's caption (title + subtitle), a segmented progress bar
  (one segment per scene), and the controls. On finishing the last scene it shows
  the end-card.
- **Scene components** — one small component per scene, built from the helpers
  already in the file (`MockSpark`, `TONE`, `SESSION_COLOR`, `getActiveSession`,
  `useLiveClock`, `MOCK_EQUITY`, news-card styling).

### Pure playback state machine (isolated + unit-tested)
The playback logic lives in a new module **`src/lib/landingTour.ts`** so it can be
tested without rendering. It is a pure reducer over an explicit state; the UI drives
it with a timer and consumes the state.

```ts
// src/lib/landingTour.ts
export const TOUR_SCENE_COUNT = 4;

export type TourStatus = "playing" | "paused" | "ended";
export interface TourState {
  index: number;        // 0..TOUR_SCENE_COUNT-1
  status: TourStatus;
}
export type TourAction =
  | { type: "tick" }      // auto-advance one scene
  | { type: "next" }
  | { type: "prev" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "replay" }    // back to scene 0, playing
  | { type: "goto"; index: number };

export const initialTourState: TourState = { index: 0, status: "playing" };
export function tourReducer(state: TourState, action: TourAction): TourState;
```

Rules to enforce (and test):
- `tick`/`next` past the last scene → `status: "ended"` (does not loop, index clamps
  to last).
- `prev` from scene 0 → stays at 0.
- `pause`/`resume` toggle status without changing index; `tick` while paused is a
  no-op.
- `replay` → `{ index: 0, status: "playing" }` from any state (incl. `ended`).
- `goto` clamps index into range and sets `status: "playing"`.
- `next` from `ended` stays ended; `prev` from `ended` resumes playing at last scene.

### Scenes (content)
1. **Journal & Edge** — a trade "logged", then the edge verdict: win-rate 64%,
   expectancy +0.42R, profit factor 1.9, with the `MockSpark` equity curve.
2. **Missions & XP** — missions list, XP bar filling, check-in, level-up.
3. **News & macro** — 1–2 news cards with impact/direction + an LLM-summary line
   (reuses the `NewsVisual` styling).
4. **Live broker sync** — broker connect + live session clock (London / NY / Tokyo).

Timing: ~3–3.5s per scene, auto-advance via a single `setInterval`/timeout effect in
`TourPlayer` that dispatches `tick`; cleared on pause/unmount.

### Motion / accessibility
- `prefers-reduced-motion: reduce` → replace scale/slide with instant opacity cuts;
  keep auto-advance but ensure prev/next are always available for manual stepping.
- Controls have `aria-label`s; the tour container is a labelled region; `Esc` exits.

## i18n
- Update the value of `landing.hero.demo` from "Guarda la demo" → **"Guarda il tour"**
  (and EN/ES/FR/DE equivalents).
- Add `landing.tour.*` keys (scene titles + subtitles, control labels, end-card
  heading + CTA) to **all 5** language blocks in
  [`src/lib/i18n.ts`](../../../artifacts/trader-dashboard/src/lib/i18n.ts).
- The `production-copy.static.test.ts` gate forbids hardcoded copy in new UI — every
  string goes through `t()`.

## Testing & verification
- **Unit:** `src/lib/landingTour.test.ts` covering every reducer rule above.
- **Static:** i18n copy test passes (all keys present in all langs, no literals).
- **Gate:** `pnpm verify` (install → codegen → typecheck → test → build) green before
  declaring done. Then commit + `git push`.

## Files touched
- `artifacts/trader-dashboard/src/pages/LandingPage.tsx` — lift state, refactor
  `ProductMock` → `ProductPreview` + `TourPlayer` + scenes, wire the button.
- **new** `artifacts/trader-dashboard/src/lib/landingTour.ts` — pure playback reducer.
- **new** `artifacts/trader-dashboard/src/lib/landingTour.test.ts` — reducer tests.
- `artifacts/trader-dashboard/src/lib/i18n.ts` — `landing.tour.*` ×5 langs + revised
  `landing.hero.demo`.

## Honesty note
Scenes are stylised animations of the landing-page mock visuals (the same fake data
already shown), set in motion — not real post-login screenshots. This is the most
faithful result achievable without a recorded video, and stays visually consistent
with the rest of the page.
