'use client';

import { Wifi } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { initSyncEngine, teardownSyncEngine, useSyncStore } from '@lavanderpro/sync-engine';
import { useAuth } from '~/stores/auth-store';
import { LoginPinForm } from './login-pin-form';
import { ServiceWorkerRegistration } from './sw-registration';

/**
 * AuthHydrator — orquesta el ciclo de vida de auth + sync engine.
 */
export function AuthHydrator() {
  const hydrate = useAuth((s) => s.hydrate);
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const pinSetup = useAuth((s) => s.pinSetup);
  const pinUnlocked = useAuth((s) => s.pinUnlocked);
  const hydrated = useAuth((s) => s.hydrated);
  const requiresOnlineReauth = useAuth((s) => s.requiresOnlineReauth);

  const [needsUnlock, setNeedsUnlock] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (status === 'authenticated' && pinSetup && !pinUnlocked) {
      setNeedsUnlock(true);
    } else {
      setNeedsUnlock(false);
    }
  }, [hydrated, status, pinSetup, pinUnlocked]);

  const initialized = useRef(false);
  useEffect(() => {
    if (hydrated && status === 'authenticated' && pinUnlocked && !initialized.current) {
      initialized.current = true;
      initSyncEngine();
    }
    if (status === 'idle' && initialized.current) {
      initialized.current = false;
      teardownSyncEngine();
    }
  }, [hydrated, status, pinUnlocked]);

  if (requiresOnlineReauth) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-canvas">
        <div className="w-full max-w-md bg-surface border border-border rounded-md shadow-modal p-7 text-center">
          <h2 className="text-title font-bold text-fg mb-2">
            Reconectarse a internet
          </h2>
          <p className="text-meta text-muted mb-4">
            Por seguridad, tu sesión local expiró después de 7 días sin
            conexión. Inicia sesión online para continuar.
          </p>
          <a
            href="/login"
            className="text-accent font-bold hover:underline"
          >
            Ir a login online →
          </a>
        </div>
      </div>
    );
  }

  if (needsUnlock) {
    return <UnlockScreen onSuccess={() => setNeedsUnlock(false)} />;
  }

  return <ServiceWorkerRegistration />;
}

function UnlockScreen({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-canvas">
      <div className="w-full max-w-auth bg-surface border border-border rounded-md shadow-default p-7 sm:p-8">
        <div className="flex items-center gap-2.5 mb-7">
          <div className="h-9 w-9 rounded-icon bg-accent text-accent-fg flex items-center justify-center">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-fg tracking-[-0.02em]">
              Bienvenido de vuelta
            </h1>
            <p className="text-meta text-muted">Ingresa tu PIN para continuar</p>
          </div>
        </div>
        <LoginPinForm
          onSuccess={onSuccess}
          onSwitchToOnline={() => {
            window.location.href = '/login';
          }}
        />
      </div>
    </div>
  );
}