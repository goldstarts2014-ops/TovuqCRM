// Offline ishlash uchun service worker: barcha ilova fayllari keshda saqlanadi
const CACHE = 'tovuq-crm-v1';
const ASSETS = ['./', 'index.html', 'app.js', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) { e.respondWith(caches.open('tiles').then(async (c) => { const hit = await c.match(e.request); if (hit) return hit; try { const r = await fetch(e.request); if (r.ok && url.hostname.includes('tile')) c.put(e.request, r.clone()); return r; } catch { return hit || Response.error(); } })); return; }
  // Avval tarmoq (yangilanishlar darhol tushadi), bo'lmasa kesh (offline)
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
