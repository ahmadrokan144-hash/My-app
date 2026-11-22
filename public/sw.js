// Notification-enabled PWA Service Worker (never caches or intercepts live HLS streams)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'own+', body: event.data.text() };
    }
  }
  const title = data.title || 'own+';
  const options = {
    body: data.body || '',
    icon: '/icon.png?v=12',
    badge: '/favicon.png?v=12',
    tag: data.tag || 'ownplus-alert',
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.payload || {};
    event.waitUntil(
      self.registration.showNotification(payload.title || 'own+', {
        body: payload.body || '',
        icon: '/icon.png?v=12',
        badge: '/favicon.png?v=12',
        tag: payload.tag || 'ownplus-alert',
        renotify: true,
        vibrate: [180, 80, 180],
        data: { url: payload.url || '/' }
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
