'use client';

import { Alert, Button } from '@lavanderpro/ui';
import { useRouter, usePathname } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '~/stores/auth-store';

const ONBOARDING_ROUTE = '/onboarding';
const DISMISS_KEY = 'lp.onboardingGate.dismissed';

/**
 * OnboardingGate — modal overlay que aparece cuando un usuario
 * autenticado todavía no completó el onboarding inicial.
 *
 * Se muestra en cualquier ruta distinta de /onboarding. Al cerrarlo
 * (X o "Más tarde"), recordá el dismissal en sessionStorage para no
 * atosigar al usuario durante esta sesión de pestaña. Al refrescar la
 * pestaña el modal vuelve a salir (porque sessionStorage se limpia al
 * cerrar la pestaña).
 *
 * Botón primario "Ir a configurar" navega a /onboarding.
 *
 * El usuario PUEDE seguir interactuando con la página de fondo
 * (no es un redirect). Esto es por pedido explícito: modal, no redirect.
 */
export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const tenant = useAuth((s) => s.tenant);

  // Hidratamos desde sessionStorage al montar (sobrevive HMR).
  const [dismissed, setDismissed] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      /* sessionStorage puede no estar disponible */
    }
  }, []);

  const persistDismiss = (value: boolean) => {
    if (typeof window === 'undefined') return;
    try {
      if (value) {
        window.sessionStorage.setItem(DISMISS_KEY, '1');
      } else {
        window.sessionStorage.removeItem(DISMISS_KEY);
      }
    } catch {
      /* ignorar */
    }
    setDismissed(value);
  };

  // Condiciones de visibilidad:
  // - hidratado (sabemos el estado real)
  // - hay user (autenticado)
  // - hay tenant (registrado y datos hidratados desde userRepo)
  // - tenant NO completó onboarding
  // - NO estamos ya en /onboarding
  // - el usuario no cerró el modal en esta pestaña
  const shouldShow =
    hydrated &&
    !!user &&
    !!tenant &&
    !tenant.onboardingCompletedAt &&
    pathname !== ONBOARDING_ROUTE &&
    !dismissed;

  if (!shouldShow) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-fg/45 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-gate-title"
    >
      <div className="w-full max-w-md bg-surface border border-border rounded-md shadow-modal p-6 relative">
        <button
          type="button"
          onClick={() => persistDismiss(true)}
          aria-label="Cerrar"
          className="absolute right-3 top-3 h-7 w-7 inline-flex items-center justify-center text-muted hover:bg-canvas hover:text-fg rounded-icon transition-all duration-ui active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-icon bg-accent-soft text-accent flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2
            id="onboarding-gate-title"
            className="text-title font-bold text-fg"
          >
            Completa tu configuración
          </h2>
        </div>

        <p className="text-meta text-muted mb-5">
          Antes de empezar a operar, necesitás completar la configuración inicial
          de tu lavandería (datos fiscales, sucursal y WhatsApp). Solo te toma
          un par de minutos.
        </p>

        <Alert variant="info" className="mb-5">
          Podés seguir navegando, pero algunas funciones quedan limitadas hasta
          que completes la configuración.
        </Alert>

        <div className="flex items-center gap-2">
          <Button
            size="lg"
            className="flex-1"
            onClick={() => router.push(ONBOARDING_ROUTE)}
          >
            Ir a configurar
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => persistDismiss(true)}
          >
            Más tarde
          </Button>
        </div>
      </div>
    </div>
  );
}