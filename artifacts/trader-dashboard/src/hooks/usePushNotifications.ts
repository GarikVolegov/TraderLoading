import { useState, useEffect, useCallback } from "react";
import {
  DEFAULT_NOTIFICATION_PREFS,
  normalizeNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notifications";
import {
  fetchPushPreferences,
  fetchVapidPublicKey,
  registerPushSubscription,
  unregisterPushSubscription,
  updatePushPreferences,
} from "@/lib/pushNotificationsApi";
import { reportClientError } from "@/lib/clientErrorReporter";

export type { NotificationPrefs };

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS,
  );
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!isSupported) {
      setReady(true);
      return;
    }
    setReady(false);
    const subscriptionPromise = navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(setSubscription)
      .catch((error) =>
        reportClientError(error, {
          context: "push subscription lookup",
          notify: false,
        }),
      );
    const prefsPromise = fetchPushPreferences()
      .then((data) => setPrefs(normalizeNotificationPrefs(data)))
      .catch((error) =>
        reportClientError(error, {
          context: "push preferences fetch",
          notify: false,
        }),
      );
    Promise.allSettled([subscriptionPromise, prefsPromise]).finally(() =>
      setReady(true),
    );
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setLoading(true);
    try {
      const permResult = await Notification.requestPermission();
      setPermission(permResult);
      if (permResult !== "granted") return false;

      const publicKey = await fetchVapidPublicKey();
      if (!publicKey) return false;

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      await registerPushSubscription(sub.toJSON());

      setSubscription(sub);
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      await unregisterPushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
      setSubscription(null);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    } finally {
      setLoading(false);
    }
  }, [subscription]);

  const updatePref = useCallback(
    async (key: keyof NotificationPrefs, value: boolean) => {
      const updated = { ...normalizeNotificationPrefs(prefs), [key]: value };
      setPrefs(updated);
      try {
        const data = await updatePushPreferences({ [key]: value });
        setPrefs(normalizeNotificationPrefs(data));
      } catch (error) {
        reportClientError(error, {
          context: "push preference update",
          notify: false,
        });
        // Keep the optimistic local preference if the server is temporarily unavailable.
      }
    },
    [prefs],
  );

  return {
    isSupported,
    permission,
    subscription,
    prefs,
    loading,
    ready,
    subscribe,
    unsubscribe,
    updatePref,
    isSubscribed: !!subscription,
  };
}
