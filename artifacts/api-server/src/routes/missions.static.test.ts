import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const missions = readFileSync(new URL("./missions.ts", import.meta.url), "utf8");
const templates = readFileSync(new URL("./mission-templates.ts", import.meta.url), "utf8");

// The reset-today debug endpoint enabled unlimited XP farming
// (complete -> reset -> complete) and must stay removed. Check the route
// registration is gone (an explanatory comment may still mention it).
assert.doesNotMatch(missions, /router\.\w+\(\s*["'`]\/missions\/reset-today/);

// Mission completion must claim atomically: the UPDATE that flips the mission
// is guarded on completed=false, so two concurrent completes can't both award.
assert.match(
  missions,
  /\.set\(\{ completed: true[\s\S]*?eq\(missionsTable\.completed, false\)/,
);
// A lost race (0 rows updated) must not award XP.
assert.match(missions, /if \(!updatedMission\)/);

// XP is incremented in SQL (xp = xp + delta), not read-modify-write, so
// concurrent grants don't clobber each other.
assert.match(missions, /xp: sql`\$\{profileTable\.xp\} \+ \$\{awardXp\}`/);

// The per-completion award is capped as defense in depth for legacy missions.
assert.match(missions, /MISSION_XP_MAX/);

// Template routes must validate/clamp xpReward server-side (no unbounded values
// reach the DB and, via seeded missions, the profile).
assert.match(templates, /clampMissionXpReward\(xpReward\)/);
assert.match(templates, /clampedXp == null/);

console.log("missions static checks passed");
