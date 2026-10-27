/* CageTime PWA service-worker logic. Not registered on its own: /OneSignalSDKWorker.js (the single root worker)
   imports it next to OneSignal's push worker.
   - VERSION changes every release (cagetime-tools/sitecfg.py V; checked by test_pwa.py). A new VERSION = new cache;
     old caches are deleted on activate, and pages are always network-first, so nobody gets stuck on an old build.
   - JSON (events, results, fighters, rankings...): network-first, cached copy when offline.
   - Static assets (CSS/JS/images/icons/fonts on this origin): cache-first (their URLs carry ?v= cache-busts).
   - Pages: network-first, then the cached copy, then /offline.html.
   - .ics calendar feeds are never cached (calendar apps must always see the live file).
   Push: handled by OneSignal's worker, imported in /OneSignalSDKWorker.js (see push.js for the page side). */
const VERSION = '20261026c';
const STATIC = 'ct-static-' + VERSION, DATA = 'ct-data-' + VERSION, PAGES = 'ct-pages-' + VERSION;
const PRECACHE = ['/offline.html', '/style.css?v=' + VERSION, '/app.js?v=' + VERSION, '/pwa.js?v=' + VERSION, '/prefs.js?v=' + VERSION,
  '/favicon.svg', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(STATIC).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ct-') && ![STATIC, DATA, PAGES].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

async function networkFirst(req, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: cacheName === DATA });
    if (hit) return hit;
    if (fallback) { const f = await caches.match(fallback); if (f) return f; }
    throw err;
  }
}
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && res.type === 'basic') (await caches.open(STATIC)).put(req, res.clone());
  return res;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;              // Google Fonts etc.: browser default
  if (url.pathname.endsWith('.ics') || url.pathname === '/sw.js' || url.pathname === '/OneSignalSDKWorker.js') return;
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, PAGES, '/offline.html')); return; }
  if (url.pathname.endsWith('.json') || url.pathname.endsWith('.webmanifest')) { e.respondWith(networkFirst(req, DATA)); return; }
  if (/\.(css|js|png|jpe?g|webp|svg|gif|ico|woff2?)$/.test(url.pathname)) { e.respondWith(cacheFirst(req)); return; }
});

