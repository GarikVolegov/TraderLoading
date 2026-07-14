import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveSnapshotIndexPath } from "./staticSnapshot.js";

const frontendDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-test-"));
fs.mkdirSync(path.join(frontendDir, "about"), { recursive: true });
fs.writeFileSync(path.join(frontendDir, "about", "index.html"), "<h1>About</h1>");
fs.writeFileSync(path.join(frontendDir, "index.html"), "<h1>Home</h1>");

// existing prerendered route resolves
assert.equal(
  resolveSnapshotIndexPath(frontendDir, "/about"),
  path.join(frontendDir, "about", "index.html"),
);

// no matching directory -> null (falls through to SPA catch-all)
assert.equal(resolveSnapshotIndexPath(frontendDir, "/journal"), null);

// a path with a file extension is never treated as a snapshot directory
assert.equal(resolveSnapshotIndexPath(frontendDir, "/assets/index-abc123.js"), null);

// path traversal is rejected even though it has no extension
assert.equal(resolveSnapshotIndexPath(frontendDir, "/../../etc/passwd"), null);

fs.rmSync(frontendDir, { recursive: true, force: true });
console.log("staticSnapshot resolver tests passed");
