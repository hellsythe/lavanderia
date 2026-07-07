'use client';

import { useEffect } from 'react';
import { useAuth } from '~/stores/auth-store';

/**
 * AuthHydrator — restaura la sesión de localStorage al montar la app.
 *
 * Se ejecuta una sola vez al inicio. Luego las páginas protegidas pueden
 * confiar en `useAuth(state => state.user)` para saber si hay sesión.
 */
export function AuthHydrator() {
  const hydrate = useAuth((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return null;
}