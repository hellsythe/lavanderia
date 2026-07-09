'use client';

import { Spinner } from '@lavanderpro/ui';
import dynamic from 'next/dynamic';

/**
 * CategoriasPage — wrapper client-only con dynamic import para evitar
 * hydration mismatches (mismo patrón que login/page.tsx).
 */
const CategoriasContent = dynamic(
  () => import('./categorias-content').then((m) => m.CategoriasContent),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <Spinner size="xl" />
      </main>
    ),
  },
);

export default function CategoriasPage() {
  return <CategoriasContent />;
}