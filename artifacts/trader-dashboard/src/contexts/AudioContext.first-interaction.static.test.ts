import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync("src/contexts/AudioContext.tsx", "utf8");
assert.match(source, /useState<AudioMode>\("off"\)/);
assert.doesNotMatch(source, /tryAutoStart|document\.addEventListener\("(?:click|touchstart|keydown)"/);
assert.doesNotMatch(source, /setTimeout\(completeLoading,\s*2000\)/);
console.log("Audio stays off until explicitly selected and never adds an artificial first-click loading delay");
