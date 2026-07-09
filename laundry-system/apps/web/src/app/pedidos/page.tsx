'use client';

import { Spinner } from '@lavanderpro/ui';
import dynamic from 'next/dynamic';

/**
 * PedidosPage — wrapper client-only con dynamic import para evitar
 * hydration mismatches (mismo patrón que categorias, servicios, clientes).
 */
const PedidosContent = dynamic(
  () => import('./pedidos-content').then((m) => m.PedidosContent),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <Spinner size="xl" />
      </main>
    ),
  },
);

export default function PedidosPage() {
  return <PedidosContent />;
}