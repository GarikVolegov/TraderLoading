const APP_ORIGIN = self.location.origin;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "TraderLOADING", body: event.data.text() };
  }

  const { title, body, icon, badge, tag, data = {}, requireInteraction, vibrate, actions } = payload;
  const scheduledCall = data.scheduledCall;
  const scheduledCallUrl = data.url || (scheduledCall ? `/?scheduledCall=${encodeURIComponent(JSON.stringify(scheduledCall))}` : null);

  const options = {
    body: body || "",
    icon: icon || `${APP_ORIGIN}/app-icon-192.png`,
    badge: badge || `${APP_ORIGIN}/app-icon-192.png`,
    tag: tag || "traderloading-default",
    renotify: !!tag,
    data: { ...data, url: scheduledCallUrl || data.url },
    vibrate: Array.isArray(vibrate) ? vibrate : [200, 100, 200],
    requireInteraction: typeof requireInteraction === "boolean" ? requireInteraction : false,
    actions: Array.isArray(actions) ? actions : [],
  };

  event.waitUntil(self.registration.showNotification(title || "TraderLOADING", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || APP_ORIGIN;
  const url = new URL(rawUrl, APP_ORIGIN).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(APP_ORIGIN) && "focus" in client) {
          if (url !== APP_ORIGIN) {
            client.navigate(url);
          }
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
