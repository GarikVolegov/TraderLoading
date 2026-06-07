import { apiJSON, type RelativeApiOptions } from "./apiFetch";
import type { NotificationPrefs } from "./notifications";

export type PushSubscriptionPayload = {
  endpoint?: string | null;
  keys?: {
    p256dh?: string | null;
    auth?: string | null;
  };
};

type VapidPublicKeyResponse = {
  publicKey: string | null;
};

export function fetchPushPreferences(options?: RelativeApiOptions): Promise<Partial<NotificationPrefs>> {
  return apiJSON<Partial<NotificationPrefs>>("push/preferences", undefined, options);
}

export async function fetchVapidPublicKey(options?: RelativeApiOptions): Promise<string | null> {
  const data = await apiJSON<VapidPublicKeyResponse>("push/vapid-public-key", undefined, options);
  return data.publicKey;
}

export function registerPushSubscription(
  subscription: PushSubscriptionPayload,
  options?: RelativeApiOptions,
): Promise<{ ok: boolean }> {
  return apiJSON<{ ok: boolean }>("push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  }, options);
}

export function unregisterPushSubscription(endpoint: string, options?: RelativeApiOptions): Promise<{ ok: boolean }> {
  return apiJSON<{ ok: boolean }>("push/unsubscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }, options);
}

export function updatePushPreferences(
  prefs: Partial<NotificationPrefs>,
  options?: RelativeApiOptions,
): Promise<Partial<NotificationPrefs>> {
  return apiJSON<Partial<NotificationPrefs>>("push/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  }, options);
}
