const CACHE_NAME = "agres-espacamento-apk-v51";
const INDEX_URL = "./index.html";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./service-worker.js",
  "./assets/agres-brand.jpeg",
  "./assets/agres-report-logo.jpg",
  "./assets/logo_agres.png",
  "./assets/tractor-planter-top.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_URL, copy));
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true })
          .then((cached) => cached || caches.match(INDEX_URL)))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then((cached) => {
        if (cached) return cached;

        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && response.type === "basic") {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(() => caches.match("./index.html"));
      })
  );
});
