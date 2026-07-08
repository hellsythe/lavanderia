'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AuthHydrator } from './auth-hydrator';
import { initSyncEngine, useNetworkStore } from '@lavanderpro/sync-engine';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
            /**
             * Offline-first: no tirar error cuando no hay red.
             * El queryFn debe fallar gracefully (retornar cache de Dexie).
             */
            networkMode: 'always',
          },
          mutations: {
            retry: 0,
            networkMode: 'always',
          },
        },
      }),
  );

  // Init sync engine + network detection una sola vez al montar
  useEffect(() => {
    useNetworkStore.getState().init();
    initSyncEngine();
  }, []);

  return (
    <QueryClientProvider client={client}>
      <AuthHydrator />
      {children}
    </QueryClientProvider>
  );
}