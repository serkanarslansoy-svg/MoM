// Offline support for the installed app.
// Pages are fetched network-first so a new version shows up as soon as the
// phone is online. Same-origin responses get cross-origin isolation headers,
// which lets speech recognition use several CPU cores.
// Whisper model files are cached by transformers.js itself ("transformers-cache").
const PREFIX = "verbale-";
const VERSION = PREFIX + "v4";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./logo.png",
  "./img/header-art.jpg",
  "./img/seat-icon.jpg",
  "./rec-worklet.js",
  "./asr-worker.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];
const RUNTIME_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isolate(response) {
  if (!response || response.status === 0 || response.type === "opaque") return response;
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then(hit => hit || (request.mode === "navigate" ? caches.match("./index.html") : undefined))
          .then(hit => hit || Response.error()))
        .then(isolate)
    );
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(response => {
        if (response.ok || response.type === "opaque") {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
