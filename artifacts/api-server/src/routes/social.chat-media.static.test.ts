import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./social.ts", import.meta.url), "utf8");

// DM file attachments must be served by an authenticated, participant-scoped
// route (not the public static handler), and access must be recorded at upload.
assert.match(src, /router\.get\("\/uploads\/chat-files\/:filename"/);
assert.match(src, /row\.ownerUserId !== userId && row\.peerUserId !== userId/);
assert.match(src, /areMutualFollowers\(userId, toUserId\)/);
assert.match(src, /insert\(chatFileAccessTable\)/);

console.log("social chat-media static checks passed");
