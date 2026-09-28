// Offline support for the installed app: serve the latest page when online,
// fall back to the cached copy when not. GitHub API calls are never cached.
const CACHE = "long-way-home-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  const cacheable = e.request.method === "GET" &&
    (url.origin === location.origin || url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com");
  if (!cacheable || url.pathname.endsWith("/map.json")) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(m => m || (e.request.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
