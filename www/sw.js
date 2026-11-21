const CACHE = 'cajham-v8';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];
// Recursos externos que usa la app (estilos, iconos, fuentes): se guardan para que abra sin internet
const CDN = [
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.cn/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Great+Vibes&display=swap'
];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    await Promise.allSettled(CDN.map(async u => {
      const req = new Request(u, { mode: 'no-cors' });
      const r = await fetch(req);
      await c.put(req, r);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // el video usa Range requests: que lo pida directo el navegador
  if (req.headers.has('range') || /\.mp4($|\?)/.test(req.url)) return;
  // la página principal: primero la red (así llegan las actualizaciones), y si no hay internet, la guardada
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(rej, 6000))]);
        if (r && r.ok) c.put('./index.html', r.clone());
        return r;
      } catch (err) {
        return (await c.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  // cache primero (rápido y offline) y se actualiza en segundo plano
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    return r || (await c.match('./index.html')) || Response.error();
  })());
});
