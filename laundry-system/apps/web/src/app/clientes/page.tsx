'use client';

import { Spinner } from '@lavanderpro/ui';
import dynamic from 'next/dynamic';

/**
 * ClientesPage — wrapper client-only con dynamic import para evitar
 * hydration mismatches (mismo patrón que login, categorias, servicios).
 */
const ClientesContent = dynamic(
  () => import('./clientes-content').then((m) => m.ClientesContent),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <Spinner size="xl" />
      </main>
    ),
  },
);

export default function ClientesPage() {
  return <ClientesContent />;
}