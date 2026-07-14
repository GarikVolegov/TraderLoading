import assert from "node:assert/strict";
import { uploadsPersistenceWarning } from "./uploads.js";

// Finding 2.5: with UPLOADS_DIR unset, uploads go to cwd/uploads — ephemeral on
// Railway, so avatars/journal images/community+chat files vanish on every redeploy.
// Warn the operator at boot instead of silently losing data.

// Non-production: never warns (local dev disk is fine).
assert.equal(uploadsPersistenceWarning({ NODE_ENV: "development" }), null);
assert.equal(uploadsPersistenceWarning({}), null);

// Production with UPLOADS_DIR set: the operator configured a target → trust it.
assert.equal(uploadsPersistenceWarning({ NODE_ENV: "production", UPLOADS_DIR: "/data/uploads" }), null);

// Production with UPLOADS_DIR unset/blank: warn about the ephemeral path.
assert.match(uploadsPersistenceWarning({ NODE_ENV: "production" }) ?? "", /UPLOADS_DIR/);
assert.match(uploadsPersistenceWarning({ NODE_ENV: "production", UPLOADS_DIR: "   " }) ?? "", /redeploy/i);

console.log("uploads persistence checks passed");
