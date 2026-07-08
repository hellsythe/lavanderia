'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker de PWA.
 * Solo corre en producción y en el browser (no en SSR).
 *
 * Si el navegador no soporta SW (ej: development en algunos casos),
 * simplemente no hace nada.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = async () => {
      try {
        // Solo en HTTPS o localhost
        const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
        if (!isSecure) return;

        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none', // siempre checkear updates
        });

        // Check for updates cada 60 min
        setInterval(() => reg.update(), 60 * 60_000);

        // eslint-disable-next-line no-console
        console.log('[SW] Registered:', reg.scope);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[SW] Registration failed:', e);
      }
    };

    void register();
  }, []);

  return null;
}