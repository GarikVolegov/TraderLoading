// After a deploy the previous build's hashed chunks 404, so a lazy route import
// throws `vite:preloadError` and the SPA crashes to a full-screen error. The fix is
// to reload once (the new index.html points at the new chunks) — but guarded, so a
// preloadError that a reload can't fix doesn't put the tab in an infinite reload loop.
const STORAGE_KEY = "tl:preload-reload-at";

/** Whether to reload now in response to a chunk preload error. Reloads once, then
 *  suppresses further reloads for `cooldownMs` (a genuinely later deploy reloads
 *  again once the cooldown passes). Records the decision in the given storage. */
export function shouldReloadForPreloadError(
  storage: Pick<Storage, "getItem" | "setItem">,
  now: number,
  cooldownMs = 10_000,
): boolean {
  const raw = storage.getItem(STORAGE_KEY);
  const last = raw === null ? Number.NaN : Number(raw);
  if (Number.isFinite(last) && now - last < cooldownMs) return false;
  storage.setItem(STORAGE_KEY, String(now));
  return true;
}
