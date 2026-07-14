import assert from "node:assert/strict";
import { shouldReloadForPreloadError } from "./preloadReload.js";

function fakeStorage(): Pick<Storage, "getItem" | "setItem"> {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
  };
}

// Finding 2.7: after a deploy the old hashed chunks 404, so a lazy route import throws
// vite:preloadError and the SPA crashes to a full-screen error. First such error →
// reload once to fetch the new chunks.
{
  const storage = fakeStorage();
  assert.equal(shouldReloadForPreloadError(storage, 1_000_000, 10_000), true);

  // A second preloadError right after the reload (reload didn't fix it) must NOT
  // reload again — otherwise the tab reload-loops forever.
  assert.equal(shouldReloadForPreloadError(storage, 1_003_000, 10_000), false);
  assert.equal(shouldReloadForPreloadError(storage, 1_009_999, 10_000), false);

  // After the cooldown, a fresh preloadError (e.g. a later deploy) reloads again.
  assert.equal(shouldReloadForPreloadError(storage, 1_010_000, 10_000), true);
}

// A garbage stored value is treated as "never reloaded".
{
  const storage = fakeStorage();
  storage.setItem("tl:preload-reload-at", "not-a-number");
  assert.equal(shouldReloadForPreloadError(storage, 5_000, 10_000), true);
}

console.log("preload reload checks passed");
