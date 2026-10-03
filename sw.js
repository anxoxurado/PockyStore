/* =====================================================
   PockyStore - Service Worker
   Estrategias:
   - App Shell  -> Cache First (precaché en install)
   - API        -> Network First con respaldo en caché
   ===================================================== */

const VERSION = 'v1';
const SHELL_CACHE = `pocketstore-shell-${VERSION}`;
const DATA_CACHE = `pocketstore-data-${VERSION}`;

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

const API_HOST = 'jsonplaceholder.typicode.com';

/* ---------- INSTALL: precarga del App Shell ---------- */
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando', VERSION);
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

/* ---------- ACTIVATE: limpieza de cachés antiguas ---------- */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando', VERSION);
  const allowed = [SHELL_CACHE, DATA_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('pocketstore-') && !allowed.includes(key))
          .map((key) => {
            console.log('[SW] Borrando caché antigua:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});

/* ---------- FETCH: recuperación de información ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Datos de la API: Network First
  if (url.hostname === API_HOST) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Archivos propios (App Shell): Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});

/* Cache First: sirve desde caché; si no existe, va a la red y la guarda */
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Sin red y sin caché: si era una navegación, devolvemos el shell
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
  }
}

/* Network First: intenta la red, actualiza la caché; si falla, usa la caché */
async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      // Marcamos la respuesta para que app.js sepa que viene de la caché
      const headers = new Headers(cached.headers);
      headers.set('X-Served-By', 'service-worker-cache');
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers
      });
    }
    return new Response(JSON.stringify({ error: 'Sin conexión y sin datos en caché' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
