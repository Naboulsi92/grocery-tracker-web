/* global self */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `grocery-shell-${CACHE_VERSION}`;
const INVENTORY_CACHE = `grocery-inventory-${CACHE_VERSION}`;
const PRECACHE_URLS = ['/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== INVENTORY_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// Navigation: online → serve fresh; offline → offline.html (read-only)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(navigationFallback(request));
    return;
  }

  if (isInventoryUrl(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Inventory payloads (items/categories/positions): read-only cache so the
// list stays viewable offline. Never used for writes (GET only).
function staleWhileRevalidate(request) {
  const cachePromise = caches.open(INVENTORY_CACHE).then((cache) => cache.match(request));

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(INVENTORY_CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  return cachePromise.then((cached) =>
    networkPromise.then((network) => {
      if (network) return network;
      if (cached) return cached;
      return new Response(JSON.stringify({ error: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

function navigationFallback(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok && response.type === 'basic') {
        const clone = response.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
      }
      return response;
    })
    .catch(() =>
      caches.match(request).then((cached) => cached || caches.match('/offline.html')),
    );
}

function isInventoryUrl(url) {
  const inventoryTables = ['items', 'categories', 'category_positions'];
  const isSupabaseRest =
    isSupabaseHost(url) && inventoryTables.some((table) => url.pathname.includes(`/rest/v1/${table}`));
  return (url.origin === self.location.origin && url.pathname.startsWith('/api/')) || isSupabaseRest;
}

function isSupabaseHost(url) {
  return (url.hostname && url.hostname.toLowerCase().includes('supabase')) || url.port === '54321';
}

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