const APP_ORIGIN = self.location.origin;
const CACHE_NAME_ASSETS = "aureus-assets-v2";
const CACHE_NAME_PAGES = "aureus-pages-v2";
const EXPECTED_CACHES = new Set([CACHE_NAME_ASSETS, CACHE_NAME_PAGES]);

self.addEventListener("install", () => {
  // Non forzare skipWaiting immediato durante sessioni attive dell'operatore.
  // L'aggiornamento viene applicato su conferma esplicita o al riavvio pulito dell'app.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        if ("caches" in self) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => !EXPECTED_CACHES.has(key))
              .map((key) => caches.delete(key)),
          );
          // Purga sempre la cache delle pagine all'attivazione per evitare index.html con chunk obsoleti
          await caches.delete(CACHE_NAME_PAGES);
        }
      } catch {
        // Ignore cache cleanup errors
      }
      await clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== APP_ORIGIN) return;

  // Never cache API endpoints or live version check
  if (url.pathname.startsWith("/api/") || url.pathname === "/version.json") {
    return;
  }

  // Cache-First for immutable hashed assets, fonts, sounds, and static brand icons
  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/sounds/") ||
    url.pathname.startsWith("/audio/") ||
    url.pathname.startsWith("/app-icon-") ||
    url.pathname.startsWith("/limen-");

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME_ASSETS).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return cachedResponse || new Response(null, { status: 504 });
        }
      }),
    );
    return;
  }

  // Network-First for SPA navigations and pages with offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME_PAGES);
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
            cache.put("/", networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cachedResponse = (await cache.match(event.request)) || (await cache.match("/"));
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AUREUS Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#0A0A0C;color:#F4F4F6;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;"><div><h1 style="color:#C5A059;font-size:1.5rem;letter-spacing:0.1em;text-transform:uppercase;">AUREUS PROTOCOL</h1><p style="color:#8E8E99;margin-top:0.5rem;">Modalità disconnessa. Riconnettiti per proseguire.</p></div></body></html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "AUREUS", body: event.data.text() };
  }

  const { title, body, icon, badge, tag, data = {}, requireInteraction, vibrate, actions } = payload;
  const scheduledCall = data.scheduledCall;
  const scheduledCallUrl = data.url || (scheduledCall ? `/?scheduledCall=${encodeURIComponent(JSON.stringify(scheduledCall))}` : null);

  const options = {
    body: body || "",
    icon: icon || `${APP_ORIGIN}/app-icon-192.png`,
    badge: badge || `${APP_ORIGIN}/app-icon-192.png`,
    tag: tag || "aureus-default",
    renotify: !!tag,
    data: { ...data, url: scheduledCallUrl || data.url },
    vibrate: Array.isArray(vibrate) ? vibrate : [200, 100, 200],
    requireInteraction: typeof requireInteraction === "boolean" ? requireInteraction : false,
    actions: Array.isArray(actions) ? actions : [],
  };

  event.waitUntil(self.registration.showNotification(title || "AUREUS", options));
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
