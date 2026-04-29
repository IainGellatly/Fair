self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  console.log("SW VERSION TEST 2");
  console.log("PUSH RECEIVED", event);

  event.waitUntil((async () => {

    let title = "Fair Reminder";
    let body = "Event starting soon";

    try {
      if (event.data) {
        try {
          const data = event.data.json();
          title = data.title || title;
          body = data.body || body;
        } catch (e) {
          body = event.data.text();
        }
      }

      console.log("SHOWING NOTIFICATION:", title, body);

      await self.registration.showNotification(title, {
        body: body,
        icon: '/static/logo.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: "fair-alert",
        renotify: true
      });

      console.log("NOTIFICATION SHOWN");

    } catch (err) {
      console.error("SW ERROR:", err);
    }

  })());
});