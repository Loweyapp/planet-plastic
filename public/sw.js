var CACHE = 'planet-plastic-v3';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/manifest.json'])));
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
  if (e.request.url.includes('api.anthropic.com')) return;
  if (e.request.url.includes('googleapis.com'))    return;
  if (e.request.url.includes('gstatic.com'))       return;
  if (e.request.url.includes('firestore.googleapis.com')) return;
  // Always fetch HTML from network so the app shell stays fresh
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
