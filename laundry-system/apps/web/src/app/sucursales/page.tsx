'use client';

import { Spinner } from '@lavanderpro/ui';
import dynamic from 'next/dynamic';

const SucursalesContent = dynamic(
  () => import('./sucursales-content').then((m) => m.SucursalesContent),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <Spinner size="xl" />
      </main>
    ),
  },
);

export default function SucursalesPage() {
  return <SucursalesContent />;
}
