import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routinePage = readFileSync(new URL("./Routine.tsx", import.meta.url), "utf8");
const zenZone = readFileSync(new URL("../components/routine/ZenZone.tsx", import.meta.url), "utf8");
const programCard = readFileSync(new URL("../components/routine/ProgramCard.tsx", import.meta.url), "utf8");
const statsPanel = readFileSync(new URL("../components/routine/RoutineStatsPanel.tsx", import.meta.url), "utf8");
const sessionModal = readFileSync(new URL("../components/routine/SessionModal.tsx", import.meta.url), "utf8");

// ZenZone: breathing + mood check-in, no Zen-only tabs survive.
assert.match(zenZone, /export function ZenZone/);
assert.match(zenZone, /Respirazione guidata/);
assert.match(zenZone, /Check-in emotivo/);
assert.doesNotMatch(zenZone, /MeditationTimer|MotivationalQuotes|ResultVisualization/);

// Routine page composes ZenZone; the removed sections are gone.
assert.match(routinePage, /<ZenZone/);
assert.doesNotMatch(routinePage, /FriendCompetitionPanel|CreateRoutinePanel|CustomRoutineCard/);

console.log("routine+zen merge static checks passed");
