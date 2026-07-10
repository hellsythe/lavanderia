'use client';

import { Spinner } from '@lavanderpro/ui';
import dynamic from 'next/dynamic';

const ConfiguracionContent = dynamic(
  () => import('./configuracion-content').then((m) => m.ConfiguracionContent),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <Spinner size="xl" />
      </main>
    ),
  },
);

export default function ConfiguracionPage() {
  return <ConfiguracionContent />;
}
