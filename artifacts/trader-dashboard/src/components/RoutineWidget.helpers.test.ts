import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getNextRoutineProgram,
  getRoutineProgramHref,
  getRoutineStatusCopy,
  getRoutineSocialMetrics,
} from "./RoutineWidget.helpers.js";

assert.equal(getRoutineStatusCopy(0), "Nessuna sessione completata");
assert.equal(getRoutineStatusCopy(1), "Una sessione completata");
assert.equal(getRoutineStatusCopy(2), "Sessioni completate");
assert.equal(getRoutineStatusCopy(5), "Sessioni completate");

assert.deepEqual(getRoutineSocialMetrics(undefined, undefined), {
  activeChallengeFriends: 0,
});

assert.deepEqual(
  getRoutineSocialMetrics(
    [
      { friendshipId: 1, friendUserId: "a", name: "A", online: true },
      { friendshipId: 2, friendUserId: "b", name: "B", online: false },
    ],
    undefined,
  ),
  {
    activeChallengeFriends: 1,
  },
);

assert.equal(getRoutineProgramHref("morning"), "/routine?start=morning");
assert.equal(getRoutineProgramHref("evening"), "/routine?start=evening");
assert.equal(getNextRoutineProgram(false, false), "morning");
assert.equal(getNextRoutineProgram(true, false), "evening");
assert.equal(getNextRoutineProgram(false, true), "morning");
assert.equal(getNextRoutineProgram(true, true), null);

const widgetSource = readFileSync(new URL("./RoutineWidget.tsx", import.meta.url), "utf8");
assert.doesNotMatch(widgetSource, /Detailed Progress|New Routines|RoutineShortcut|routineShortcutContent/);
assert.match(widgetSource, /amici in sfida attivi/);
assert.match(widgetSource, /loadRoutineCompletions/);
assert.doesNotMatch(widgetSource, /Streak originale|useGetProfile/);

console.log("routine widget helper checks passed");
