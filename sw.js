const CACHE_NAME = "fair-cache-v3";

const APP_SHELL = [
  "/",
  "/static/app.js",
  "/static/cache.js",
  "/static/styles.css",
  "/static/manifest.webmanifest"
];

self.addEventListener("install", event => {

  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {

  // Only intercept page navigation.
  // Let the browser handle everything else normally.

  if (event.request.mode !== "navigate") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match("/"))
  );

});

self.addEventListener('push', function(event) {
  console.log("PUSH RECEIVED", event);

  event.waitUntil((async () => {

    let title = "Fair Reminder";
    let body = "Event starting soon";
    let url = "/?page=today";   // 👈 default fallback

    try {
      if (event.data) {
        try {
          const data = event.data.json();
          title = data.title || title;
          body = data.body || body;
          url = data.url || url;   // 👈 NEW
        } catch (e) {
          body = event.data.text();
        }
      }

      console.log("SHOWING NOTIFICATION:", title, body);

        await self.registration.showNotification(title, {
          body: body,
          icon: '/static/logo.webp',
          badge: '/static/logo.webp',
          vibrate: [200, 100, 200, 100, 200],
          requireInteraction: true,
//          tag: "fair-alert",
//          renotify: true,
          data: { url: url }   // 👈 NEW
        });

      console.log("NOTIFICATION SHOWN");

    } catch (err) {
      console.error("SW ERROR:", err);
    }

  })());
});

self.addEventListener('notificationclick', function(event) {

  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(windowClients => {

        // Try to focus existing app window
        for (let client of windowClients) {
          if (client.url.includes("/") && "focus" in client) {
            return client.focus();
          }
        }

        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

