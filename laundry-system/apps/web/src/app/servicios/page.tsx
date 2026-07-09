'use client';

import { Spinner } from '@lavanderpro/ui';
import dynamic from 'next/dynamic';

/**
 * ServiciosPage — wrapper client-only con dynamic import para evitar
 * hydration mismatches (mismo patrón que login/page.tsx).
 */
const ServiciosContent = dynamic(
  () => import('./servicios-content').then((m) => m.ServiciosContent),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <Spinner size="xl" />
      </main>
    ),
  },
);

export default function ServiciosPage() {
  return <ServiciosContent />;
}