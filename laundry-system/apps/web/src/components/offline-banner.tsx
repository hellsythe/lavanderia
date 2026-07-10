'use client';

import { Alert } from '@lavanderpro/ui';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useNetworkStore, useSyncStore } from '@lavanderpro/sync-engine';
import { useState } from 'react';

/**
 * OfflineBanner — banner contextual que aparece dentro del `<main>` de
 * cada módulo cuando no hay internet.
 *
 * Comportamiento:
 * - Solo visible cuando `network.state === 'offline'`
 * - No sticky: se monta como primer hijo del `<main>`, dejando el
 *   espacio necesario para que el contenido fluya normalmente.
 * - Permite "Reintentar ahora" para forzar un recheck del heartbeat.
 * - El padding del `<main id="main">` (p-5 sm:p-6) ya da margen
 *   horizontal; el banner ocupa todo el ancho interno del main.
 *
 * Mensaje: tone & voice funcional, directo, es-MX.
 */
export function OfflineBanner() {
  const networkState = useNetworkStore((s) => s.state);
  const pending = useSyncStore((s) => s.pendingCount);
  const recheck = useNetworkStore((s) => s.recheck);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await recheck();
    setRetrying(false);
  };

  if (networkState !== 'offline') return null;

  return (
    <div className="mb-4" role="alert" aria-live="assertive">
      <Alert variant="warning" icon={<CloudOff className="h-4 w-4" />}>
        <div className="flex-1 min-w-0 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <strong className="font-bold">Sin conexión a internet.</strong>{' '}
            <span className="text-meta">
              {pending > 0 ? (
                <>
                  Tienes {pending} cambio{pending > 1 ? 's' : ''}{' '}
                  pendiente{pending > 1 ? 's' : ''} que se sincronizarán
                  automáticamente al reconectar.
                </>
              ) : (
                <>
                  Los cambios que hagas se guardan localmente y se
                  sincronizarán al volver la conexión.
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm bg-warning/10 text-warning font-bold text-[12px] hover:bg-warning/20 transition-colors duration-ui disabled:opacity-60"
            aria-label="Reintentar conexión"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`}
            />
            {retrying ? 'Reintentando…' : 'Reintentar'}
          </button>
        </div>
      </Alert>
    </div>
  );
}
