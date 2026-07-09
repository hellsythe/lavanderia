'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label, PasswordInput, Spinner } from '@lavanderpro/ui';
import { RegisterInputSchema, type RegisterInput } from '@lavanderpro/shared-types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthShell } from '~/components/auth-shell';
import { useAuth } from '~/stores/auth-store';

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useAuth((s) => s.register);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterInputSchema),
    defaultValues: {
      tenantName: '',
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await registerUser(data);
      router.push('/onboarding');
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error al crear la cuenta');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main id="main">
      <AuthShell
        title="Crear cuenta"
        subtitle="Registra tu lavandería en LavanderPro."
        alert={serverError ? { type: 'error', message: serverError } : null}
        footer={
          <>
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-accent font-bold hover:opacity-80 hover:underline">
              Iniciar sesión
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tenantName" variant="caps">
              Nombre de la lavandería
            </Label>
            <Input
              id="tenantName"
              type="text"
              autoComplete="organization"
              placeholder="Lavandería Sol"
              invalid={!!errors.tenantName}
              {...register('tenantName')}
            />
            {errors.tenantName && (
              <span className="text-meta text-danger font-semibold mt-0.5">
                {errors.tenantName.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" variant="caps">
              Nombre completo
            </Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Juan Pérez"
              invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <span className="text-meta text-danger font-semibold mt-0.5">
                {errors.name.message}
              </span>
            )}
          </div>

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
            {errors.email && (
              <span className="text-meta text-danger font-semibold mt-0.5">
                {errors.email.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" variant="caps">
              Contraseña
            </Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <span className="text-meta text-danger font-semibold mt-0.5">
                {errors.password.message}
              </span>
            )}
            <p className="text-meta text-muted">La contraseña debe tener al menos 8 caracteres.</p>
          </div>

          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Spinner size="sm" tone="inverse" />
                Creando cuenta…
              </>
            ) : (
              'Crear cuenta'
            )}
          </Button>
        </form>
      </AuthShell>
    </main>
  );
}