/* GEHU Portal service worker: fast repeat visits + offline fallback.
   Network-first for pages/code (so deploys always show up), stale-while-revalidate for img/ and vendor/.
   API calls (other origin) are never touched. Bump V to force-clear old caches. */
const V = "gehu-v2";
const SHELL = ["./", "index.html", "home.css", "home-plus.css", "home-plus.js", "shell.css", "config.js", "img/logo.webp", "img/logo-96.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (/\.(mp4|webm|mov)$/i.test(u.pathname) || r.headers.has("range")) return;   // let the browser stream video itself (Safari/iOS need real Range responses)
  if (/^\/(img|vendor)\//.test(u.pathname)) {
    e.respondWith(caches.open(V).then(async (c) => {
      const hit = await c.match(r);
      const net = fetch(r).then((res) => { if (res.status === 200) c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  e.respondWith(
    fetch(r).then((res) => { if (res.status === 200) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r).then((h) => h || caches.match("index.html")))
  );
});
