import assert from "node:assert/strict";

import { clampMissionXpReward, MISSION_XP_MAX } from "./missionXp.js";

// Valid rewards pass through unchanged.
assert.equal(clampMissionXpReward(10), 10);
assert.equal(clampMissionXpReward(1), 1);
assert.equal(clampMissionXpReward(MISSION_XP_MAX), 100);

// The exploit: a mission template with an arbitrarily large xpReward would add
// that XP to the profile on completion and dominate the Pro leaderboard. The
// reward must be capped, not trusted.
assert.equal(clampMissionXpReward(1_000_000), 100);
assert.equal(clampMissionXpReward(101), 100);

// Fractionals are floored to a whole XP value.
assert.equal(clampMissionXpReward(50.9), 50);

// Invalid input is rejected (null) so the route can respond 400.
assert.equal(clampMissionXpReward(0), null);
assert.equal(clampMissionXpReward(-5), null);
assert.equal(clampMissionXpReward(Number.NaN), null);
assert.equal(clampMissionXpReward("abc"), null);
assert.equal(clampMissionXpReward(null), null);
assert.equal(clampMissionXpReward(undefined), null);

console.log("mission xp clamp checks passed");
