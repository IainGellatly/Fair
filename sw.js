self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
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
          icon: '/static/logo.png',
          badge: '/static/logo.png',
          vibrate: [200, 100, 200, 100, 200],
          tag: "fair-alert",
          requireInteraction: true,
          renotify: true,
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

