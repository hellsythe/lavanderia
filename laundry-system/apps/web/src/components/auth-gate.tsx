'use client';

import { Spinner } from '@lavanderpro/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '~/stores/auth-store';

/**
 * AuthGate — protege las rutas del lado del cliente.
 *
 * Es OBLIGATORIO porque el frontend se sirve como export estático
 * (sin servidor Node), así que nginx hace fallback a index.html
 * para cualquier ruta desconocida. Sin este gate, /asdasdad → index.html
 * → dashboard, sin chequear auth.
 *
 * Flujo:
 *   1. Mientras `hydrated === false`, mostramos un spinner
 *      (evita flash del dashboard antes de saber el estado de auth).
 *   2. Una vez hidratado, si la ruta no es pública y no hay user → /login.
 *   3. Si requiere reauth online y no estamos ya en /login → /login.
 *
 * El gating de onboarding (modal "completá tu configuración") se hace
 * en `OnboardingGate`, montado en layout.tsx. Acá solo se maneja auth.
 *
 * Rutas públicas: /login y /registro. Todo lo demás requiere sesión.
 */
const PUBLIC_ROUTES = new Set(['/login', '/registro']);

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const requiresOnlineReauth = useAuth((s) => s.requiresOnlineReauth);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const isPublic = PUBLIC_ROUTES.has(pathname);

    if (!user && !isPublic) {
      router.replace('/login');
      return;
    }

    if (requiresOnlineReauth && !isPublic) {
      router.replace('/login');
    }
  }, [hydrated, user, requiresOnlineReauth, pathname, router]);

  if (!mounted || !hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="xl" />
          <span className="text-meta text-muted">Cargando…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}