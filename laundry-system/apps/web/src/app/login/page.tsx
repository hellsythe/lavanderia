'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label, PasswordInput } from '@lavanderpro/ui';
import { LoginInputSchema, type LoginInput } from '@lavanderpro/shared-types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthShell } from '~/components/auth-shell';
import { useAuth } from '~/stores/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: { email: '', password: '' },
  });

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
      // Si fue credenciales inválidas, marcar ambos campos
      if (message.toLowerCase().includes('credencial')) {
        setError('email', { type: 'server', message: '' });
        setError('password', { type: 'server', message: '' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main id="main">
      <AuthShell
        title="Iniciar sesión"
        subtitle="Accede al panel de control de tu lavandería."
        alert={serverError ? { type: 'error', message: serverError } : null}
        footer={
          <>
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className="text-accent font-bold hover:opacity-80 hover:underline">
              Crear cuenta
            </Link>
          </>
        }
      >
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

          <div className="flex items-center justify-between text-[12.5px]">
            <label className="flex items-center gap-1.5 text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
              />
              <span>Recordarme</span>
            </label>
            <button
              type="button"
              className="text-accent font-bold hover:opacity-80 hover:underline"
              onClick={() => alert('Próximamente — contacta al administrador.')}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <span className="inline-block h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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