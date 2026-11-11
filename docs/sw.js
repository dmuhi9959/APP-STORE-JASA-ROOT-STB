/* AAP STORE — service worker sederhana
   Tujuan: shell web store tetap bisa dibuka saat internet putus,
   dan katalog terakhir tetap tampil.

   Strategi:
   - App shell (html/css/js/ikon) : cache-first, update di background
   - catalog.json                 : network-first, fallback ke cache
   - file APK & domain luar       : langsung ke jaringan (jangan di-cache!)
*/
const VERSION = 'aapstore-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './catalog.json',
  './icon-192.png',
  './icon-512.png',
  './favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // APK / CDN luar: biarkan lewat

  if (url.pathname.endsWith('.apk')) return; // jangan pernah cache APK

  if (url.pathname.endsWith('catalog.json')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => caches.match('./index.html'))
    )
  );
});
