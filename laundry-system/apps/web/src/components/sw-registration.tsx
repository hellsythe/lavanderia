'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker de PWA.
 * Solo corre en producción y en el browser (no en SSR).
 *
 * Flujo de update (PATRÓN ESTÁNDAR PWA — sin esto la página queda con
 * el bundle viejo tras un deploy):
 *   1. Navegación posterior detecta un nuevo SW (updatefound).
 *   2. Cuando el nuevo worker está 'installed' y ya hay un controller
 *      activo (no es el primer install) → postMessage SKIP_WAITING
 *      para que el SW nuevo tome control.
 *   3. Cuando el SW nuevo toma control, el evento 'controllerchange'
 *      dispara → reload() para que la página use el bundle nuevo.
 *
 * Sin este flujo, el SW nuevo tomaba control silenciosamente pero la
 * página seguía corriendo el bundle viejo (cacheado por el SW viejo).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
    if (!isSecure) return;

    // Cuando un nuevo SW toma control, recargar la página para que use
    // el bundle nuevo (no seguir ejecutando el viejo cacheado).
    // Filtramos: solo recargar si YA había un controller (es decir, esto
    // es un update, no el primer install).
    const onControllerChange = () => {
      if (navigator.serviceWorker.controller) {
        // eslint-disable-next-line no-console
        console.log('[SW] New controller activated — reloading');
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none', // siempre checkear updates
        });

        // Check for updates cada 60 min (background)
        setInterval(() => reg.update(), 60 * 60_000);

        // Detectar nuevo SW disponible
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            // 'installed' = nuevo SW descargado y listo, esperando a activarse.
            // Si ya hay un controller activo (es un update, no primer install),
            // le pedimos que tome control YA. El SW va a hacer skipWaiting()
            // y eso disparará 'controllerchange' → reload().
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // eslint-disable-next-line no-console
              console.log('[SW] New worker installed, sending SKIP_WAITING');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // eslint-disable-next-line no-console
        console.log('[SW] Registered:', reg.scope);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[SW] Registration failed:', e);
      }
    };

    void register();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}