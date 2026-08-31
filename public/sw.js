/* global self */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() };
  }

  const title = safeText(payload.title, 'Liste de courses', 80);
  const options = {
    body: safeText(payload.body, 'Votre liste de courses a été mise à jour.', 240),
    icon: '/notification-icon.svg',
    badge: '/notification-badge.svg',
    data: { url: sameOriginPath(payload.url) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const path = sameOriginPath(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = new URL(path, self.location.origin).href;
    const existing = windows.find((client) => client.url === target);
    if (existing) return existing.focus();
    return self.clients.openWindow(path);
  })());
});

function sameOriginPath(value) {
  try {
    const url = new URL(typeof value === 'string' ? value : '/', self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch {
    return '/';
  }
}

function safeText(value, fallback, maxLength) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}
