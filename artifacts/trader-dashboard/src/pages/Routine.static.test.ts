import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routinePage = readFileSync(new URL("./Routine.tsx", import.meta.url), "utf8");
const programCard = readFileSync(new URL("../components/routine/ProgramCard.tsx", import.meta.url), "utf8");
const statsPanel = readFileSync(new URL("../components/routine/RoutineStatsPanel.tsx", import.meta.url), "utf8");
const friendPanel = readFileSync(new URL("../components/routine/FriendCompetitionPanel.tsx", import.meta.url), "utf8");
const customCard = readFileSync(new URL("../components/routine/CustomRoutineCard.tsx", import.meta.url), "utf8");

// Route/section wiring stays intact (1:1 restyle — nothing removed).
assert.match(routinePage, /<ProgramCard\b/);
assert.match(routinePage, /<RoutineStatsPanel\b/);
assert.match(routinePage, /<FriendCompetitionPanel\b/);
assert.match(routinePage, /<CreateRoutinePanel\b/);
assert.match(routinePage, /<CustomRoutineCard\b/);
assert.match(routinePage, /<SessionModal\b/);

// ProgramCard: accent-color top strip.
assert.match(programCard, /h-0\.75 w-full shrink-0/);

// RoutineStatsPanel: centered StatTile-spec tiles (no icon, mono tabular value).
assert.match(statsPanel, /shadow-\[inset_0_1px_0_hsl\(var\(--foreground\)\/0\.04\)\]/);
assert.doesNotMatch(statsPanel, /CheckCircle2/);

// FriendCompetitionPanel: silver/bronze accents for rank 2/3, not just gold rank 1.
assert.match(friendPanel, /RANK_ACCENT/);
assert.match(friendPanel, /slate-300/);
assert.match(friendPanel, /amber-700/);

// CustomRoutineCard: same accent-strip treatment as ProgramCard, for visual consistency.
assert.match(customCard, /h-0\.75 w-full/);

console.log("routine page static checks passed");
