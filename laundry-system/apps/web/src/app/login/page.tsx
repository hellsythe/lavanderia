'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label, PasswordInput, Spinner } from '@lavanderpro/ui';
import { LoginInputSchema, type LoginInput } from '@lavanderpro/shared-types';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNetworkStore } from '@lavanderpro/sync-engine';
import { Alert } from '@lavanderpro/ui';
import { Wifi, WifiOff } from 'lucide-react';
import { AuthShell } from '~/components/auth-shell';
import { LoginPinForm } from '~/components/login-pin-form';
import { useAuth } from '~/stores/auth-store';

/**
 * LoginPage es client-only (ssr: false) para evitar hydration mismatches
 * — el form a mostrar depende de useState/useEffect que solo corren
 * en el cliente. Sin esto, el servidor renderiza un form y el cliente
 * otro, fallando la hidratación.
 */
const LoginPageContent = dynamic(() => import('./login-content').then((m) => m.LoginContent), {
  ssr: false,
  loading: () => (
    <main id="main">
      <AuthShell title="Iniciar sesión" subtitle="Accede al panel de control de tu lavandería.">
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      </AuthShell>
    </main>
  ),
});

export default function LoginPage() {
  return <LoginPageContent />;
}