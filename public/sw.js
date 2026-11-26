// Guarda la app en el dispositivo para que abra sin conexión (como WhatsApp o Spotify).
// Primero la red: con conexión siempre se usa la versión recién publicada y se actualiza la copia
// guardada. Sin conexión (o si la red tarda más de 3 s) se usa la copia. Solo guarda los archivos de
// la app y la biblioteca de Supabase del CDN; nunca los datos ni las llamadas a la nube (eso lo
// hace app.js con su propia copia del diario).
const CACHE = 'focus-app-v1';
const CDN = 'https://cdn.jsdelivr.net/';
const SLOW = 3000;

const ours = url => {
  const u = new URL(url, self.location.href);
  return u.origin === self.location.origin || u.href.startsWith(CDN);
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));

// La página avisa qué archivos ya cargó (la primera visita ocurre antes de que exista esta copia).
self.addEventListener('message', event => {
  if (event.data?.type !== 'cache' || !Array.isArray(event.data.urls)) return;
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all([...new Set(event.data.urls)].filter(ours).map(async url => {
    try {
      if (await cache.match(url)) return;
      const res = await fetch(url);
      if (res.ok) await cache.put(url, res);
    } catch { /* se guardará la próxima vez */ }
  }))));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !ours(req.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req).then(res => {
      if (res.ok && (res.type === 'basic' || res.type === 'cors')) cache.put(req, res.clone()).catch(() => {});
      return res;
    });
    event.waitUntil(net.catch(() => {}));
    const nav = req.mode === 'navigate';
    const scope = self.registration.scope;
    const cached = await cache.match(req, { ignoreSearch: nav })
      || (nav && (await cache.match(new URL('index.html', scope).href) || await cache.match(scope)));
    if (!cached) return net;
    return Promise.race([net.catch(() => cached), new Promise(resolve => setTimeout(() => resolve(cached), SLOW))]);
  })());
});
