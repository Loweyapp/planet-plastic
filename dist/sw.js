var CACHE = 'planet-plastic-v2';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/manifest.json'])));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  // Never cache API or font calls
  if (e.request.url.includes('api.anthropic.com')) return;
  if (e.request.url.includes('googleapis.com'))    return;
  if (e.request.url.includes('gstatic.com'))       return;
  if (e.request.url.includes('firestore.googleapis.com')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
