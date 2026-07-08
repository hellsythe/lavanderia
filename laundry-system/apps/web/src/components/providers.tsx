'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AuthHydrator } from './auth-hydrator';
import { useNetworkStore } from '@lavanderpro/sync-engine';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
            networkMode: 'always',
          },
          mutations: {
            retry: 0,
            networkMode: 'always',
          },
        },
      }),
  );

  // Solo init network detection. NO inicializar el sync engine aquí —
  // el AuthHydrator lo hace después de hidratar el usuario.
  useEffect(() => {
    useNetworkStore.getState().init();
  }, []);

  return (
    <QueryClientProvider client={client}>
      <AuthHydrator />
      {children}
    </QueryClientProvider>
  );
}