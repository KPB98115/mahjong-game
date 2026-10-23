const shellCacheName = "mahjong-shell-v1";
const precachePaths = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(shellCacheName)
      .then((cache) => cache.addAll(precachePaths))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== shellCacheName).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (!shouldCacheShell(url.pathname)) {
    return;
  }
  event.respondWith(cacheFirst(request));
});

function shouldCacheShell(pathname) {
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return false;
  }
  if (pathname === "/socket.io" || pathname.startsWith("/socket.io/")) {
    return false;
  }
  if (pathname === "/manifest.webmanifest") {
    return true;
  }
  if (pathname.startsWith("/icons/")) {
    return true;
  }
  if (pathname.startsWith("/assets/")) {
    return true;
  }
  return false;
}

async function cacheFirst(request) {
  const cache = await caches.open(shellCacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}
