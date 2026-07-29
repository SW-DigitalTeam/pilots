/*
 * Offline-after-first-load service worker.
 *
 * Precaches the app shell and, at runtime, caches the pose model, the MediaPipe
 * wasm, and the audio cue bank the first time they are fetched. Once primed, a
 * dropped connection mid-session cannot interrupt audio or gameplay: everything
 * the game needs is served from the cache, network-independent.
 */
const CACHE = "arcade-arena-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest"];

// Anything under these paths is large and immutable — cache-first forever.
const RUNTIME_PREFIXES = ["/mediapipe/", "/audio/", "/assets/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const runtime = RUNTIME_PREFIXES.some((p) => url.pathname.startsWith(p));

  if (runtime) {
    // Cache-first for big immutable assets (model, wasm, cue bank).
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Network-first for the shell, falling back to cache when offline.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("/index.html"))),
  );
});
