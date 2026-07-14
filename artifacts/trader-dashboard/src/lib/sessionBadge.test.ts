import assert from "node:assert/strict";
import {
  sessionBadgeClasses,
  toneForSessionColor,
  SESSION_TONES,
  type SessionTone,
} from "./sessionBadge.js";

// Every tone yields non-empty container + dot classes.
for (const tone of SESSION_TONES) {
  const { container, dot } = sessionBadgeClasses(tone);
  assert.ok(container.length > 0, `container empty for ${tone}`);
  assert.ok(dot.length > 0, `dot empty for ${tone}`);
  assert.match(container, /\bborder\b/, `container missing border width for ${tone}`);
}

// Coloured tones use their registered colour utility + glow like the Claude Design pill.
const coloured: Record<Exclude<SessionTone, "muted">, string> = {
  "session-asian": "session-asian",
  "session-london": "session-london",
  "session-ny": "session-ny",
  "session-volume": "session-volume",
  success: "success",
  destructive: "destructive",
};
for (const [tone, colour] of Object.entries(coloured) as [SessionTone, string][]) {
  const { container, dot } = sessionBadgeClasses(tone);
  assert.ok(container.includes(`text-${colour}`), `container for ${tone} should tint text`);
  assert.match(container, /shadow-\[0_0_16px_/, `container for ${tone} should glow`);
  assert.ok(container.includes(`bg-${colour}/12`), `container bg for ${tone} should be 12% opacity`);
  assert.ok(container.includes(`border-${colour}/30`), `container border for ${tone} should be 30% opacity`);
  assert.ok(dot.includes(`bg-${colour}`), `dot for ${tone} should use the colour`);
  assert.match(dot, /shadow-\[0_0_8px_/, `dot for ${tone} should glow`);
}

// Muted is a spent pill: no glow on container or dot.
const mutedClasses = sessionBadgeClasses("muted");
assert.doesNotMatch(mutedClasses.container, /shadow-\[0_0_16px_/);
assert.doesNotMatch(mutedClasses.dot, /shadow-\[0_0_8px_/);

// toneForSessionColor: closed session → destructive; trading colours pass through;
// unknown → muted.
assert.equal(toneForSessionColor("session-closed"), "destructive");
assert.equal(toneForSessionColor("session-asian"), "session-asian");
assert.equal(toneForSessionColor("session-london"), "session-london");
assert.equal(toneForSessionColor("session-ny"), "session-ny");
assert.equal(toneForSessionColor("session-volume"), "session-volume");
assert.equal(toneForSessionColor("nonsense"), "muted");

console.log("sessionBadge checks passed");
