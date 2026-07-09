'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label, PasswordInput, Spinner } from '@lavanderpro/ui';
import { LoginInputSchema, type LoginInput } from '@lavanderpro/shared-types';
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
 * Componente client-only. Se carga dinámicamente desde page.tsx
 * para evitar hydration mismatches.
 */
export function LoginContent() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const pinSetup = useAuth((s) => s.pinSetup);
  const networkState = useNetworkStore((s) => s.state);

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPinForm, setShowPinForm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (pinSetup && networkState === 'offline') {
      setShowPinForm(true);
    }
  }, [pinSetup, networkState]);

  const onSubmit = async (data: LoginInput) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await login(data);
      router.push('/');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setServerError(message);
      if (message.toLowerCase().includes('credencial')) {
        setError('email', { type: 'server', message: '' });
        setError('password', { type: 'server', message: '' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (showPinForm) {
    return (
      <main id="main">
        <AuthShell
          title="Iniciar sesión"
          subtitle="Accede al panel de control de tu lavandería."
          alert={
            serverError
              ? { type: 'error', message: serverError }
              : null
          }
          footer={
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPinForm(false)}
                className="text-accent font-bold hover:opacity-80 hover:underline"
              >
                ← Iniciar con contraseña
              </button>
              <Link
                href="/registro"
                className="text-accent font-bold hover:opacity-80 hover:underline"
              >
                Crear cuenta
              </Link>
            </div>
          }
        >
          <LoginPinForm
            onSuccess={() => {
              router.push('/');
              router.refresh();
            }}
            onSwitchToOnline={() => setShowPinForm(false)}
          />
        </AuthShell>
      </main>
    );
  }

  return (
    <main id="main">
      <AuthShell
        title="Iniciar sesión"
        subtitle="Accede al panel de control de tu lavandería."
        alert={serverError ? { type: 'error', message: serverError } : null}
        footer={
          <>
            {pinSetup && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowPinForm(true)}
                  className="text-meta text-accent font-bold hover:underline inline-flex items-center gap-1"
                >
                  <WifiOff className="h-3.5 w-3.5" />
                  ¿Sin internet? Usa tu PIN
                </button>
              </div>
            )}
            ¿No tienes cuenta?{' '}
            <Link
              href="/registro"
              className="text-accent font-bold hover:opacity-80 hover:underline"
            >
              Crear cuenta
            </Link>
          </>
        }
      >
        {networkState === 'offline' && !pinSetup && (
          <Alert variant="info" icon={<Wifi className="h-4 w-4" />}>
            Sin conexión. Para usar LavanderPro sin internet, primero
            necesitas iniciar sesión online y configurar un PIN.
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" variant="caps">
              Correo electrónico
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              invalid={!!errors.email}
              {...register('email')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" variant="caps">
              Contraseña
            </Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <span className="text-meta text-danger font-semibold mt-0.5">
                {errors.password.message}
              </span>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Spinner size="sm" tone="inverse" />
                Iniciando sesión…
              </>
            ) : (
              'Iniciar sesión'
            )}
          </Button>
        </form>
      </AuthShell>
    </main>
  );
}