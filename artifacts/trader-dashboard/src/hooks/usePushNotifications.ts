import { useState, useEffect, useCallback } from "react";
import {
  DEFAULT_NOTIFICATION_PREFS,
  normalizeNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notifications";

const API_BASE = "/api";

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
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
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
      .catch(() => {});
    const prefsPromise = fetch(`${API_BASE}/push/preferences`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setPrefs(normalizeNotificationPrefs(data)))
      .catch(() => {});
    Promise.allSettled([subscriptionPromise, prefsPromise]).finally(() => setReady(true));
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setLoading(true);
    try {
      const permResult = await Notification.requestPermission();
      setPermission(permResult);
      if (permResult !== "granted") return false;

      const keyRes = await fetch(`${API_BASE}/push/vapid-public-key`, { credentials: "include" });
      const { publicKey } = await keyRes.json();
      if (!publicKey) return false;

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch(`${API_BASE}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sub.toJSON()),
      });

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
      await fetch(`${API_BASE}/push/unsubscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      setSubscription(null);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    } finally {
      setLoading(false);
    }
  }, [subscription]);

  const updatePref = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    const updated = { ...normalizeNotificationPrefs(prefs), [key]: value };
    setPrefs(updated);
    const response = await fetch(`${API_BASE}/push/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ [key]: value }),
    }).catch(() => null);
    if (response?.ok) {
      const data = await response.json().catch(() => null);
      setPrefs(normalizeNotificationPrefs(data));
    }
  }, [prefs]);

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
