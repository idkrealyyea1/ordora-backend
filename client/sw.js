'use strict';

/* Lightweight service worker: offline app shell for weak Palestinian networks.
   - Navigations: network-first with cache fallback (fresh menus/orders).
   - Static assets: cache-first.
   - API + uploads: never cached (must stay live/fresh). */

const CACHE = 'restaurants-v21';
const SHELL = [
  '/',
  '/css/style.css',
  '/css/restivo.css',
  '/css/storefront.css',
  '/css/marketing.css',
  '/css/skeleton.css',
  '/fonts/fonts.css',
  '/js/api.js',
  '/js/i18n.js',
  '/js/home.js',
  '/js/restaurant.js',
  '/js/restivo-content.js',
  '/js/restivo-landing.js',
  '/js/track.js',
  '/js/pwa.js',
  '/js/skeleton.js',
  '/js/site.js',
  '/images/restivo-food-table.jpg',
  '/images/restivo-owner-tablet.jpg',
  '/login.html',
  '/app/',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStatic(url) {
  return SHELL.includes(url.pathname + (url.search || '')) ||
    /\.(css|js|svg|png|jpg|jpeg|webp|woff2?)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() =>
          caches.match(event.request).then((hit) => hit || caches.match('/'))
        )
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.match(event.request).then((hit) =>
        hit ||
        fetch(event.request).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          }
          return resp;
        })
      )
    );
  }
});

/* Owner new-order push (additive: caching behavior above is untouched). */

self.addEventListener('push', (event) => {
  let data = null;
  try {
    data = event.data ? event.data.json() : null;
  } catch (_) {
    data = null;
  }
  const title = (data && data.title) || 'طلب جديد · New order';
  const body = (data && data.body) || '';
  const tag = (data && data.tag) || 'new-order';
  const url = (data && data.url) || '/admin.html#orders';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin.html#orders';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.includes('/admin.html')) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
