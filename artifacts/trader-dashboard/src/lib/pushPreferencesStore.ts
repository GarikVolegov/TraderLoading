import type { NotificationPrefs } from "./notifications";

type PushPrefsSnapshot = Partial<NotificationPrefs>;

const cachedPrefs = new Map<string, PushPrefsSnapshot>();
const pendingPrefs = new Map<string, Promise<PushPrefsSnapshot>>();

export function loadSharedPushPreferences(
  fetchPrefs: () => Promise<PushPrefsSnapshot>,
  accountId = "anonymous",
): Promise<PushPrefsSnapshot> {
  const cached = cachedPrefs.get(accountId);
  if (cached) return Promise.resolve(cached);
  const pending = pendingPrefs.get(accountId);
  if (pending) return pending;

  const request = fetchPrefs()
    .then((prefs) => {
      cachedPrefs.set(accountId, prefs);
      return prefs;
    })
    .finally(() => {
      pendingPrefs.delete(accountId);
    });
  pendingPrefs.set(accountId, request);
  return request;
}

export function setSharedPushPreferences(prefs: PushPrefsSnapshot, accountId = "anonymous"): void {
  cachedPrefs.set(accountId, prefs);
}

export function resetSharedPushPreferencesForTest(): void {
  cachedPrefs.clear();
  pendingPrefs.clear();
}
