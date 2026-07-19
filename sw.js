const CACHE = 'nexus-v1';
const CORE = ['index.html','app.js','style.css','manifest.json','icon-192.png','icon-512.png','vendor/qrcode.min.js','vendor/jspdf.umd.min.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  // Cache each core file independently so one failed/missing file (e.g. an optional
  // vendor lib) does NOT abort the entire offline cache.
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(u => fetch(u).then(r => { if (r && r.ok) return c.put(u, r); }).catch(() => {})));
  })());
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET') return;            // never cache mutations
  if (url.pathname.startsWith('/api/')) return; // always hit network for API
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || network;
  })());
});

self.addEventListener('push', e => {
  let data = { title: 'Nexus ERP', body: '' };
  try { data = Object.assign(data, e.data ? e.data.json() : {}); } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icon-512.png' }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => { if (list.length) list[0].focus(); else self.clients.openWindow('/'); }));
});
