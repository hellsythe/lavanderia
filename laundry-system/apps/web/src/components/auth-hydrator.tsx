'use client';

import { useEffect } from 'react';
import { initSyncEngine, teardownSyncEngine } from '@lavanderpro/sync-engine';
import { useAuth } from '~/stores/auth-store';

/**
 * AuthHydrator — restaura la sesión de localStorage al montar la app.
 *
 * Responsabilidades:
 * 1. Hidratar el store de auth desde localStorage
 * 2. Inicializar el sync engine SOLO si hay usuario autenticado
 * 3. Tear-down del sync engine al hacer logout
 */
export function AuthHydrator() {
  const hydrate = useAuth((s) => s.hydrate);
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);

  // Hidratar al montar
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Inicializar/destruir sync engine según estado de auth.
  // - Cuando hay usuario autenticado → initSyncEngine()
  // - Cuando logout → teardownSyncEngine()
  useEffect(() => {
    if (status === 'authenticated' && user) {
      initSyncEngine();
    }
    return () => {
      // Cleanup si el user se desautentica
      if (status !== 'authenticated') {
        teardownSyncEngine();
      }
    };
  }, [status, user]);

  return null;
}