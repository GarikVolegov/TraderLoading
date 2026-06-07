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

  const { title, body, icon, badge, tag, data = {} } = payload;

  const options = {
    body: body || "",
    icon: icon || `${APP_ORIGIN}/app-icon.png`,
    badge: badge || `${APP_ORIGIN}/app-icon.png`,
    tag: tag || "traderloading-default",
    renotify: !!tag,
    data,
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title || "TraderLOADING", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || APP_ORIGIN;

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
