import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/contexts/AudioContext.tsx", "utf8");

const immediateAutoStartCall = source.indexOf("tryAutoStart();");
const firstClickListener = source.indexOf('document.addEventListener("click", tryAutoStart, true)');

assert.notEqual(firstClickListener, -1, "AudioProvider should listen for a user click to unlock audio.");
assert(
  immediateAutoStartCall === -1 || firstClickListener < immediateAutoStartCall,
  "AudioProvider must wait for the first user interaction before starting Web Audio.",
);

console.log("audio first-interaction static checks passed");
