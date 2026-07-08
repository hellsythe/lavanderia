'use client';

import { useEffect, useState } from 'react';
import { SetupPinModal } from './setup-pin-modal';
import { useAuth } from '~/stores/auth-store';
import { useNetworkStore } from '@lavanderpro/sync-engine';

const SHOWN_KEY = 'lp.setup-pin-shown';

/**
 * PinSetupGate — orquesta cuándo mostrar el modal de setup PIN.
 *
 * Triggers:
 *  - El user acaba de hacer login online (primera vez)
 *  - El user está online y NO tiene PIN configurado
 *  - El user no ha skipeado el setup antes
 *
 * El user puede skipear — seguirá usando la app online sin PIN, pero
 * no podrá reabrir sesión offline.
 */
export function PinSetupGate() {
  const status = useAuth((s) => s.status);
  const pinSetup = useAuth((s) => s.pinSetup);
  const hydrated = useAuth((s) => s.hydrated);
  const isOnline = useNetworkStore((s) => s.state === 'online');

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hydrated) return;
    if (status !== 'authenticated') return;
    if (pinSetup) return;
    if (!isOnline) return;
    // Solo mostrar una vez por sesión (no spamear al user)
    if (sessionStorage.getItem(SHOWN_KEY)) return;

    // Pequeño delay para que no aparezca instantáneamente al login
    const t = setTimeout(() => {
      setShowModal(true);
      sessionStorage.setItem(SHOWN_KEY, '1');
    }, 1500);
    return () => clearTimeout(t);
  }, [hydrated, status, pinSetup, isOnline]);

  if (!showModal) return null;

  return (
    <SetupPinModal
      onComplete={() => setShowModal(false)}
      onSkip={() => {
        setShowModal(false);
        sessionStorage.setItem(SHOWN_KEY, 'skipped');
      }}
    />
  );
}