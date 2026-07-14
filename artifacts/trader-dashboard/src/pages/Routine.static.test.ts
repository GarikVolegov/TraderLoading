import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routinePage = readFileSync(new URL("./Routine.tsx", import.meta.url), "utf8");
const zenZone = readFileSync(new URL("../components/routine/ZenZone.tsx", import.meta.url), "utf8");
const programCard = readFileSync(new URL("../components/routine/ProgramCard.tsx", import.meta.url), "utf8");
const statsPanel = readFileSync(new URL("../components/routine/RoutineStatsPanel.tsx", import.meta.url), "utf8");
const sessionModal = readFileSync(new URL("../components/routine/SessionModal.tsx", import.meta.url), "utf8");

// ZenZone: breathing + mood check-in, no Zen-only tabs survive.
assert.match(zenZone, /export function ZenZone/);
assert.match(zenZone, /routine\.zenzone\.breathing_title/);
assert.match(zenZone, /routine\.zenzone\.mood_title/);
assert.doesNotMatch(zenZone, /MeditationTimer|MotivationalQuotes|ResultVisualization/);

// ProgramCard: simplified per the mockup — 44px icon, no per-card step-pill list.
assert.match(programCard, /h-11 w-11/); // 44px = h-11/w-11 in Tailwind's 4px scale
assert.doesNotMatch(programCard, /steps\.filter/);

// RoutineStatsPanel: 4 tiles only (Streak/Completate/Mattutine/Serali), no per-routine list.
assert.match(statsPanel, /Mattutine/);
assert.match(statsPanel, /Serali/);
assert.doesNotMatch(statsPanel, /byRoutine/);

// SessionModal: single prominent progress bar + "Passo N di M" label (no segmented pills).
assert.match(sessionModal, /Passo \{stepIdx \+ 1\} di \{steps\.length\}/);
assert.doesNotMatch(sessionModal, /Step pills/);

// Removed sections are gone from routineApi.ts too.
const routineApi = readFileSync(new URL("../lib/routineApi.ts", import.meta.url), "utf8");
assert.doesNotMatch(routineApi, /fetchRoutineCompetition|routineCompetitionQueryKey|RoutineCompetitionEntry/);

// Routine.tsx composes the new sections in order and drops custom-routine UI.
assert.match(routinePage, /<ProgramCard\b/);
assert.match(routinePage, /<ZenZone/);
assert.match(routinePage, /<RoutineStatsPanel\b/);
assert.match(routinePage, /<SessionModal\b/);
assert.doesNotMatch(routinePage, /loadCustomRoutines|createCustomRoutine|CreateRoutinePanel|CustomRoutineCard|FriendCompetitionPanel/);

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const bottomNav = readFileSync(new URL("../components/BottomNav.tsx", import.meta.url), "utf8");
const commandPalette = readFileSync(new URL("../components/CommandPalette.tsx", import.meta.url), "utf8");
const navHubs = readFileSync(new URL("../lib/navHubs.ts", import.meta.url), "utf8");

// /zen is gone from routing, nav, command palette, and hubs.
assert.doesNotMatch(app, /pages\/Zen|path="\/zen"/);
assert.doesNotMatch(bottomNav, /href: "\/zen"/);
const rootItemsBlock = bottomNav.slice(bottomNav.indexOf("const ROOT_ITEMS"), bottomNav.indexOf("const SECONDARY_ITEMS"));
assert.match(rootItemsBlock, /href: "\/routine"/, "routine takes over zen's old root-level mobile nav slot");
assert.doesNotMatch(commandPalette, /zen\.title/);
assert.doesNotMatch(navHubs, /ZEN_HUB|\/zen/);

console.log("routine+zen merge static checks passed");
