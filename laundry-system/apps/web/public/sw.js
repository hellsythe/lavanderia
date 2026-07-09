/**
 * LavanderPro Service Worker
 *
 * Estrategia: "stale-while-revalidate" para assets Next.js
 * - HTML/navigation: network-first → fallback a cache
 * - _next/static/*: cache-first (inmutable, tiene hash en filename)
 * - API calls: NUNCA cacheados (van por el sync engine)
 * - Otros assets: stale-while-revalidate
 *
 * Cache versioning: bump CACHE_NAME cuando cambies estrategia
 * para que los clientes invaliden caches viejos automáticamente.
 *
 * Flujo de update: NO skipWaiting() automático. El cliente (página) decide
 * cuándo activarlo vía postMessage({type: 'SKIP_WAITING'}) después de
 * detectar un nuevo worker (evento 'updatefound'). Cuando el SW activa,
 * 'controllerchange' dispara un reload() en la página → bundle nuevo.
 */

const CACHE_VERSION = 'v5'; // bump cuando cambia estrategia — invalida caches viejos
const STATIC_CACHE = `lavanderpro-static-${CACHE_VERSION}`;
const PAGES_CACHE = `lavanderpro-pages-${CACHE_VERSION}`;
const RUNTIME_CACHE = `lavanderpro-runtime-${CACHE_VERSION}`;

// Assets que son parte del shell de la app (precached al instalar)
const PRECACHE_URLS = [
  '/',
  '/login',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  // eslint-disable-next-line no-console
  console.log('[SW] Installing');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Precache shell. Si alguno falla, seguimos (no bloqueamos install).
      await cache.addAll(PRECACHE_URLS).catch((e) => {
        console.warn('[SW] Precache failed:', e);
      });
      // NO skipWaiting() automático: el cliente decide cuándo activarnos
      // para evitar el bug "stale bundle tras update" (la página seguía
      // corriendo el JS viejo cacheado mientras el SW nuevo tomaba control).
      // El cliente nos manda postMessage({type: 'SKIP_WAITING'}) cuando está listo.
    })(),
  );
});

self.addEventListener('activate', (event) => {
  // eslint-disable-next-line no-console
  console.log('[SW] Activating');
  event.waitUntil(
    (async () => {
      // Limpiar caches viejos (de versiones anteriores a CACHE_VERSION).
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => !name.endsWith(`-${CACHE_VERSION}`))
          .map((name) => caches.delete(name)),
      );
      // Tomar control de clientes no controlados (clientes que ya estaban
      // cargados antes de nuestra activación). Es seguro hacerlo aquí porque
      // ya no tenemos `skipWaiting()` — este SW es el que el cliente eligió.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. NO cachear API ni sync — esos pasan por el sync engine
  if (url.pathname.startsWith('/api/')) {
    return; // deja pasar al network
  }

  // 2. Assets de Next.js con hash → cache-first (inmutables)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 3. HTML / navegación SPA → network-first, fallback a cache
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, PAGES_CACHE));
    return;
  }

  // 4. Otros assets (imágenes, fuentes, etc.) → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    // Network falló. Devolver un fallback si existe.
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    // Sin red → fallback al cache
    const cached = await cache.match(request);
    if (cached) return cached;
    // Si no hay cache para esta ruta, devolver index.html (SPA fallback)
    const indexCache = await cache.match('/');
    if (indexCache) return indexCache;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  // Devolver cache inmediatamente si existe, mientras se revalida en background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

// Mensaje desde la app (skipWaiting, etc.).
// El cliente envía SKIP_WAITING solo cuando está listo (ej: detectó un
// updatefound y quiere forzar la activación).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
