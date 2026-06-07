import assert from "node:assert/strict";
import { formatFileSize } from "./fileFormatting.js";

assert.equal(formatFileSize(0), "0 B");
assert.equal(formatFileSize(1), "1 B");
assert.equal(formatFileSize(1023), "1023 B");
assert.equal(formatFileSize(1024), "1.0 KB");
assert.equal(formatFileSize(1536), "1.5 KB");
assert.equal(formatFileSize(1024 * 1024 - 1), "1024.0 KB");
assert.equal(formatFileSize(1024 * 1024), "1.0 MB");
assert.equal(formatFileSize(2.5 * 1024 * 1024), "2.5 MB");

console.log("file formatting checks passed");
