const CACHE_NAME = 'erp-pos-v1';
const ASSETS = ['index.html', 'style.css', 'app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const clone = res.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, clone)); return res; }).catch(() => caches.match('index.html')))); });
