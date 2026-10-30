/* Hobbys97 : version hors ligne.
   - Pages et fichiers du site : réseau d’abord (toujours la dernière version), copie de secours si pas de connexion.
   - Images (pochettes, affiches, couvertures) : gardées en cache, donc visibles hors ligne une fois vues.
   - Bases de données (Firebase, Supabase, Mangacollec, TMDB…) : jamais touchées. */
const PAGES = "h97-pages-v1", IMGS = "h97-img-v1", MAX_IMG = 4000;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== PAGES && k !== IMGS) await caches.delete(k);
  await self.clients.claim();
})()));

const corsFetch = async url => { try { const r = await fetch(url, { mode: "cors", credentials: "omit" }); if (r.ok) return r; } catch {} return null; };
let puts = 0;
async function trim(cache) {
  if (++puts % 60) return;
  const keys = await cache.keys(); if (keys.length <= MAX_IMG) return;
  for (const k of keys.slice(0, keys.length - MAX_IMG + 200)) await cache.delete(k);
}
async function networkFirst(req, key) {
  const cache = await caches.open(PAGES);
  const net = fetch(req).then(r => { if (r && r.status === 200 && (r.type === "basic" || r.type === "cors")) cache.put(key, r.clone()); return r; });
  // réseau lent (mobile) : au bout de 4 s on montre la copie, le réseau finit de la mettre à jour
  const slow = new Promise(res => setTimeout(res, 4000, null));
  try { const r = await Promise.race([net, slow]); if (r) return r; } catch {}
  const hit = await cache.match(key, { ignoreSearch: true }); if (hit) return hit;
  return net;
}
async function imageFirst(req) {
  const cache = await caches.open(IMGS), hit = await cache.match(req.url);
  if (hit) return hit;
  const r = await corsFetch(req.url);
  if (r) { cache.put(req.url, r.clone()).then(() => trim(cache)).catch(() => {}); return r; }
  return fetch(req);
}
async function libFirst(req) {
  const cache = await caches.open(PAGES);
  try { const r = await corsFetch(req.url); if (r) { cache.put(req.url, r.clone()).catch(() => {}); return r; } } catch {}
  const hit = await cache.match(req.url); if (hit) return hit;
  return fetch(req);
}
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url); if (!/^https?:$/.test(url.protocol)) return;
  const d = req.destination;
  if (d === "audio" || d === "video") return;                       // musiques : lecture en continu, pas de cache
  if (url.origin === location.origin) { e.respondWith(networkFirst(req, req.mode === "navigate" ? url.origin + url.pathname : req.url)); return; }
  if (d === "image") { e.respondWith(imageFirst(req)); return; }
  if ((d === "script" || d === "style" || d === "font") && !/itunes\.apple\.com|deezer|api\./.test(url.hostname)) { e.respondWith(libFirst(req)); return; }
});
