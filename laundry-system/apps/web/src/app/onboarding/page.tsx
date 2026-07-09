'use client';

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
        <span className="inline-block h-8 w-8 border-2 border-muted/30 border-t-accent rounded-full animate-spin" />
      </main>
    ),
  },
);

export default function OnboardingPage() {
  return <OnboardingContent />;
}