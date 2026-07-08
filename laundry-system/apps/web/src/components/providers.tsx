'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useNetworkStore } from '@lavanderpro/sync-engine';
import { AuthHydrator } from './auth-hydrator';
import { PinSetupGate } from './pin-setup-gate';

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

  useEffect(() => {
    useNetworkStore.getState().init();
  }, []);

  return (
    <QueryClientProvider client={client}>
      <AuthHydrator />
      <PinSetupGate />
      {children}
    </QueryClientProvider>
  );
}