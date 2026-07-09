'use client';

import { Spinner } from '@lavanderpro/ui';
import dynamic from 'next/dynamic';

/**
 * OnboardingPage — wrapper client-only con dynamic import para evitar
 * hydration mismatches (mismo patrón que login/page.tsx).
 *
 * Reglas:
 * - Si el tenant ya completó onboarding → el content redirige a /.
 * - Si no hay sesión → AuthGate ya redirige a /login.
 */
const OnboardingContent = dynamic(
  () => import('./onboarding-content').then((m) => m.OnboardingContent),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <Spinner size="xl" />
      </main>
    ),
  },
);

export default function OnboardingPage() {
  return <OnboardingContent />;
}