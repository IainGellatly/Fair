const APP_VERSION = 22;

const CACHE_NAME = `fair-cache-v${APP_VERSION}`;

const APP_SHELL = [
  "/",
  "/static/app.js",
  "/static/cache.js",
  "/static/styles.css",
  "/static/manifest.webmanifest"
];

self.addEventListener("install", event => {

    self.skipWaiting();

    event.waitUntil((async () => {

        const cache = await caches.open(CACHE_NAME);

        for (const file of APP_SHELL) {

            const fetchUrl =
                (file === "/")
                    ? file
                    : `${file}?v=${APP_VERSION}`;

            console.log("Caching:", fetchUrl);

            const response = await fetch(fetchUrl, {
                cache: "reload"
            });

            await cache.put(file, response.clone());

        }

    })());

});

self.addEventListener("activate", event => {

    event.waitUntil((async () => {

        const names = await caches.keys();

        await Promise.all(
            names.map(name => {

                if (name !== CACHE_NAME) {
                    console.log("Deleting old cache:", name);
                    return caches.delete(name);
                }

            })
        );

        await self.clients.claim();

    })());

});

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);

    // Serve cached shell files
    if (
        url.pathname === "/" ||
        url.pathname === "/static/app.js" ||
        url.pathname === "/static/cache.js" ||
        url.pathname === "/static/styles.css" ||
        url.pathname === "/static/manifest.webmanifest"
    ) {

        event.respondWith((async () => {

            const cache = await caches.open(CACHE_NAME);

            const cached = await cache.match(url.pathname);

            if (cached) {
                console.log("SW serving:", url.pathname);
                return cached;
            }

            return fetch(event.request);

        })());

        return;
    }

    // Everything else unchanged
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

