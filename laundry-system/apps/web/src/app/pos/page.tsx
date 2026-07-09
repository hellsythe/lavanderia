'use client';

import { Spinner } from '@lavanderpro/ui';
import dynamic from 'next/dynamic';

/**
 * PosPage — wrapper client-only con dynamic import para evitar
 * hydration mismatches (mismo patrón que el resto de admin pages).
 */
const PosContent = dynamic(() => import('./pos-content').then((m) => m.PosContent), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-canvas flex items-center justify-center">
      <Spinner size="xl" />
    </main>
  ),
});

export default function PosPage() {
  return <PosContent />;
}