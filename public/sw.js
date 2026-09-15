// Minimal, dependency-free service worker for Ginoo's Log Book.
// Goal: installable PWA + graceful offline shell. It never caches API responses,
// mutations, or receipt images — a tax app must not show stale financial data.

const CACHE = "glb-v1";
const PRECACHE = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline — Ginoo's Log Book</title>
<style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;
align-items:center;justify-content:center;background:#15803d;color:#fff;text-align:center;padding:2rem}
h1{font-size:1.25rem;margin:0 0 .5rem}p{opacity:.85;margin:0}</style></head>
<body><div><h1>You're offline</h1><p>Reconnect to view your log book.</p></div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never touch mutations
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to the offline shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
      )
    );
    return;
  }

  // Immutable build assets + icons: cache-first (stale-while-revalidate).
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((hit) => {
          const network = fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => hit);
          return hit || network;
        })
      )
    );
  }
  // Everything else (API, receipts, dynamic data): pass through to the network untouched.
});
