import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/react";
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
import { loadSharedPushPreferences, setSharedPushPreferences } from "@/lib/pushPreferencesStore";
import { reportClientError } from "@/lib/clientErrorReporter";

export type { NotificationPrefs };

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

let sharedSubscriptionLookup: Promise<PushSubscription | null> | null = null;

function lookupSharedPushSubscription(): Promise<PushSubscription | null> {
  if (!sharedSubscriptionLookup) {
    sharedSubscriptionLookup = navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .finally(() => {
        sharedSubscriptionLookup = null;
      });
  }
  return sharedSubscriptionLookup;
}

export function usePushNotifications() {
  const { userId } = useAuth();
  const currentAccount = useRef(userId);
  currentAccount.current = userId;
  const savingPreference = useRef(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [preferenceError, setPreferenceError] = useState(false);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    let cancelled = false;
    savingPreference.current = false;
    setPreferenceSaving(false);
    setPreferenceError(false);
    setPrefs(DEFAULT_NOTIFICATION_PREFS);
    setSubscription(null);
    if (!userId) {
      setReady(true);
      return;
    }
    setReady(false);
    if (isSupported)
      void lookupSharedPushSubscription()
        .then((sub) => {
          if (!cancelled) setSubscription(sub);
        })
        .catch((error) =>
          reportClientError(error, {
            context: "push subscription lookup",
            notify: false,
          }),
        );
    void loadSharedPushPreferences(fetchPushPreferences, userId)
      .then((data) => {
        if (!cancelled) setPrefs(normalizeNotificationPrefs(data));
      })
      .catch((error) =>
        reportClientError(error, {
          context: "push preferences fetch",
          notify: false,
        }),
      )
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isSupported, userId]);

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
      if (!userId || savingPreference.current) return false;
      savingPreference.current = true;
      setPreferenceSaving(true);
      setPreferenceError(false);
      const accountId = userId;
      try {
        const data = await updatePushPreferences({ [key]: value });
        setSharedPushPreferences(data, accountId);
        if (currentAccount.current === accountId) setPrefs(normalizeNotificationPrefs(data));
        return true;
      } catch (error) {
        reportClientError(error, {
          context: "push preference update",
          notify: false,
        });
        if (currentAccount.current === accountId) setPreferenceError(true);
        return false;
      } finally {
        if (currentAccount.current === accountId) {
          savingPreference.current = false;
          setPreferenceSaving(false);
        }
      }
    },
    [userId],
  );

  return {
    isSupported,
    permission,
    subscription,
    prefs,
    loading,
    ready,
    preferenceSaving,
    preferenceError,
    subscribe,
    unsubscribe,
    updatePref,
    isSubscribed: !!subscription,
  };
}
