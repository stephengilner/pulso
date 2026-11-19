// Offline app shell. Hashed build files (assets/) are cache-first; pages and other files are network-first with a
// short timeout, falling back to the cache so the app opens in a dead zone. Cross-origin calls (Gemini, map tiles,
// fonts) are left to the browser.
const CACHE = "pulso-v2";
const SHELL = ["./", "manifest.webmanifest", "icon.svg"].map((p) => new URL(p, self.registration.scope).href);

self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); });
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));

const put = (req, res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/assets/")) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => put(e.request, res))));
    return;
  }
  const shell = e.request.mode === "navigate" ? SHELL[0] : e.request;
  const net = fetch(e.request).then((res) => put(shell, res));
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 4000));
  e.respondWith(
    Promise.race([net, timeout]).catch(() => caches.match(shell).then((hit) => hit || net))
  );
});
