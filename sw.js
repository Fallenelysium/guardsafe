/* =========================
   ProtocolBuddy - sw.js
   Offline-first Service Worker
   ========================= */

const CACHE_NAME = "protocolbuddy-v1"; // verhoog naar v2, v3... bij updates

// App shell: wat je altijd offline wil kunnen openen
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./protocols.json",
  "./manifest.json"
  // Icons voeg je toe zodra je ze hebt:
  // "./icons/icon-192.png",
  // "./icons/icon-512.png"
];

// Install: cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: verwijder oude caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Navigations (pages): network-first, fallback cache
// - Static assets + protocols.json: cache-first, fallback network
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Alleen same-origin (jouw eigen files)
  if (url.origin !== self.location.origin) return;

  // HTML navigatie: network-first (zo krijg je updates), fallback cache
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // protocols.json: cache-first (snelle offline data)
  if (url.pathname.endsWith("/protocols.json")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Overige assets: cache-first
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const fresh = await fetch(request);
    // Cache alleen geldige responses
    if (fresh && fresh.status === 200) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    // Als niets beschikbaar is, probeer de home te tonen
    return cache.match("./index.html");
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    return cached || cache.match("./index.html");
  }
}
