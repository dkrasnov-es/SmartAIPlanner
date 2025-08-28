const CACHE_NAME = "mypwa-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Always go to network for API calls
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }

  if (ASSETS.includes(url.pathname.replace(/^\/+/, "./"))) {
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
    return;
  }

  event.respondWith(
    caches
      .match(req)
      .then((cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => cached)
      )
  );
});
