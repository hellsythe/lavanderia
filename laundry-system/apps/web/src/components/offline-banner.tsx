'use client';

import { Alert } from '@lavanderpro/ui';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useNetworkStore, useSyncStore } from '@lavanderpro/sync-engine';
import { useEffect, useState } from 'react';

/**
 * OfflineBanner — banner persistente que aparece cuando no hay internet.
 *
 * Comportamiento:
 * - Solo visible cuando `network.state === 'offline'`
 * - Si el usuario está sincronizando (network === 'syncing' O isSyncing del sync),
 *   oculta este banner (el SyncIndicator en el Topbar ya lo muestra).
 * - Si el server responde (recheck automático cada 30s), se oculta.
 * - Permite "Reintentar ahora" para forzar un recheck.
 *
 * Mensaje sigue el tone & voice del design system (funcional, directo, es-MX).
 */
export function OfflineBanner() {
  const networkState = useNetworkStore((s) => s.state);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const pending = useSyncStore((s) => s.pendingCount);
  const recheck = useNetworkStore((s) => s.recheck);
  const [retrying, setRetrying] = useState(false);

  // Recheck manual
  const handleRetry = async () => {
    setRetrying(true);
    await recheck();
    setRetrying(false);
  };

  // Mostrar solo cuando offline (sync state lo maneja el SyncIndicator)
  const visible = networkState === 'offline';

  // Animación de "shake" sutil cuando cambia el estado (opcional)
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (visible) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="sticky top-topbar-h z-10 px-5 sm:px-6 py-2"
      role="alert"
      aria-live="assertive"
    >
      <Alert
        variant="warning"
        icon={<CloudOff className="h-4 w-4" />}
        className={pulse ? 'animate-pulse' : ''}
      >
        <div className="flex-1 min-w-0 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <strong className="font-bold">Sin conexión a internet.</strong>{' '}
            <span className="text-meta">
              {pending > 0 ? (
                <>
                  Tienes {pending} cambio{pending > 1 ? 's' : ''} pendiente{pending > 1 ? 's' : ''} que se
                  sincronizarán automáticamente al reconectar.
                </>
              ) : (
                <>
                  Los cambios que hagas se guardan localmente y se sincronizarán
                  al volver la conexión.
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