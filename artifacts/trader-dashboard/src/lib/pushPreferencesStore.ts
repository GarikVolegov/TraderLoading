import type { NotificationPrefs } from "./notifications";

type PushPrefsSnapshot = Partial<NotificationPrefs>;

let cachedPrefs: PushPrefsSnapshot | null = null;
let pendingPrefs: Promise<PushPrefsSnapshot> | null = null;

export function loadSharedPushPreferences(
  fetchPrefs: () => Promise<PushPrefsSnapshot>,
): Promise<PushPrefsSnapshot> {
  if (cachedPrefs) return Promise.resolve(cachedPrefs);
  if (pendingPrefs) return pendingPrefs;

  pendingPrefs = fetchPrefs()
    .then((prefs) => {
      cachedPrefs = prefs;
      return prefs;
    })
    .finally(() => {
      pendingPrefs = null;
    });

  return pendingPrefs;
}

export function setSharedPushPreferences(prefs: PushPrefsSnapshot): void {
  cachedPrefs = prefs;
}

export function resetSharedPushPreferencesForTest(): void {
  cachedPrefs = null;
  pendingPrefs = null;
}
