'use client';

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PageHeader,
  Spinner,
  Textarea,
} from '@lavanderpro/ui';
import { UpdateTenantInputSchema, ALLOWED_LOGO_MIME_TYPES } from '@lavanderpro/shared-types';
import type { UpdateTenantInput } from '@lavanderpro/shared-types';
import {
  Building2,
  Camera,
  CheckCircle2,
  Globe,
  Loader,
  MapPin,
  Phone,
  Save,
  Shield,
  Store,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sidebar } from '~/components/sidebar';
import { Topbar } from '~/components/topbar';
import { OfflineBanner } from '~/components/offline-banner';
import { useAuth } from '~/stores/auth-store';
import { useUpdateTenant, usePresignAndUploadLogo } from '~/stores/tenants-queries';
import { useNetworkStore } from '@lavanderpro/sync-engine';

/**
 * ConfiguracionContent — página de configuración de la empresa.
 *
 * Sigue el patrón canónico de admin pages: AppShell + PageHeader +
 * Cards seccionadas. Incluye:
 *  - Datos de la empresa (nombre, fiscales)
 *  - Datos de sucursal
 *  - WhatsApp
 *  - Logo (subida con presigned URL a MinIO)
 *
 * Offline-first: mutations van al auth-store local + sync_queue.
 * Logo: si está offline, se guarda en pending_uploads (Dexie).
 */
export function ConfiguracionContent() {
  const tenant = useAuth((s) => s.tenant);
  const hydrated = useAuth((s) => s.hydrated);
  const tenantId = tenant?.id ?? '';
  const isOnline = useNetworkStore((s) => s.state !== 'offline');

  const updateMut = useUpdateTenant(tenantId);
  const logoUploadMut = usePresignAndUploadLogo(tenantId);

  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateTenantInput>({
    resolver: zodResolver(UpdateTenantInputSchema),
    values: {
      name: tenant?.name ?? '',
      fiscalName: tenant?.fiscalName ?? '',
      fiscalAddress: tenant?.fiscalAddress ?? '',
      fiscalTaxId: tenant?.fiscalTaxId ?? '',
      whatsappPhone: tenant?.whatsappPhone ?? '',
    },
  });

  const onSubmit = async (data: UpdateTenantInput) => {
    try {
      await updateMut.mutateAsync(data);
      reset(data); // marca como no-dirty
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Error lo muestra la mutation
    }
  };

  const handleLogoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setLogoError('El archivo es demasiado grande (máximo 2 MB).');
      return;
    }

    if (!(ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
      setLogoError('Formato no permitido. Usá PNG, JPEG o SVG.');
      return;
    }

    setLogoError(null);
    setLogoLoading(true);

    try {
      await logoUploadMut.mutateAsync({ file });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Error al subir el logo';
      setLogoError(msg);
    } finally {
      setLogoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-canvas grid grid-cols-app">
        <Sidebar />
        <div className="min-w-0 flex flex-col items-center justify-center">
          <Spinner size="xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas grid grid-cols-app">
      <Sidebar />
      <div className="min-w-0 flex flex-col">
        <Topbar title="Configuración" breadcrumb="Datos de la empresa" />
        <main id="main" className="flex-1 p-5 sm:p-6 flex flex-col gap-5">
          <OfflineBanner />

          <PageHeader
            icon={<Building2 className="h-5 w-5" />}
            title="Datos de la empresa"
            subtitle={
              tenant?.name
                ? `Plan: ${tenant?.plan ?? 'trial'} · Slug: ${tenant?.slug ?? ''}`
                : 'Configurá los datos de tu lavandería.'
            }
          />

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            noValidate
          >
            {/* Datos fiscales */}
            <Card>
              <CardHeader>
                <CardTitle>Datos de la empresa</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    id="name"
                    label="Nombre del negocio"
                    placeholder="LavanderPro Demo"
                    error={errors.name?.message}
                    register={register('name')}
                  />
                  <Field
                    id="fiscalTaxId"
                    label="RFC"
                    placeholder="LSO200815ABC"
                    hint="Opcional"
                    error={errors.fiscalTaxId?.message}
                    register={register('fiscalTaxId')}
                  />
                </div>
                <div className="mt-4">
                  <Field
                    id="fiscalName"
                    label="Razón social"
                    placeholder="Lavandería Profesional S.A. de C.V."
                    error={errors.fiscalName?.message}
                    register={register('fiscalName')}
                  />
                </div>
                <div className="mt-4">
                  <Label htmlFor="fiscalAddress" variant="caps">
                    Dirección fiscal
                  </Label>
                  <Textarea
                    id="fiscalAddress"
                    placeholder="Av. Reforma 123, CDMX"
                    className="mt-1.5"
                    rows={2}
                    {...register('fiscalAddress')}
                  />
                  {errors.fiscalAddress?.message && (
                    <span className="text-meta text-danger font-semibold mt-0.5">
                      {errors.fiscalAddress.message}
                    </span>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Sucursales */}
            <Card>
              <CardHeader>
                <CardTitle>Sucursales</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-meta text-muted mb-3">
                  Gestioná las sucursales de tu lavandería. Cada sucursal tiene su
                  propio nombre, dirección y teléfono.
                </p>
                <Button type="button" variant="secondary" onClick={() => window.location.href = '/sucursales'}>
                  <Store className="h-4 w-4" />
                  Ir a Sucursales
                </Button>
              </CardBody>
            </Card>

            {/* WhatsApp */}
            <Card>
              <CardHeader>
                <CardTitle>WhatsApp</CardTitle>
              </CardHeader>
              <CardBody>
                <Field
                  id="whatsappPhone"
                  label="Número de WhatsApp"
                  placeholder="55 1234 5678"
                  type="tel"
                  hint={tenant?.whatsappVerifiedAt ? 'Verificado' : 'Pendiente'}
                  error={errors.whatsappPhone?.message}
                  register={register('whatsappPhone')}
                />
              </CardBody>
            </Card>

            {/* Logo */}
            <Card>
              <CardHeader>
                <CardTitle>Logo de la empresa</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="flex items-start gap-4">
                  <LogoPreview
                    url={tenant?.logoUrl}
                    businessName={tenant?.name ?? 'Lavandería'}
                  />
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label variant="caps">
                        Subir logo {!isOnline && '(se guardará para después)'}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="md"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={logoLoading}
                        >
                          {logoLoading ? (
                            <>
                              <Loader className="h-3.5 w-3.5 animate-spin" />
                              {isOnline ? 'Subiendo…' : 'Guardando…'}
                            </>
                          ) : (
                            <>
                              <Upload className="h-3.5 w-3.5" />
                              Elegir archivo
                            </>
                          )}
                        </Button>
                        <span className="text-meta text-muted">
                          PNG, JPEG o SVG · Máx 2 MB
                        </span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoPick}
                      />
                    </div>

                    {logoError && (
                      <Alert variant="info">{logoError}</Alert>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Submit */}
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                size="lg"
                disabled={!isDirty || updateMut.isPending}
              >
                {updateMut.isPending ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar cambios
                  </>
                )}
              </Button>
              {saved && (
                <span className="inline-flex items-center gap-1 text-meta text-success font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Guardado
                </span>
              )}
              {updateMut.isError && (
                <Alert variant="error">
                  {(updateMut.error as Error)?.message ?? 'Error al guardar'}
                </Alert>
              )}
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Field({
  id,
  label,
  placeholder,
  type,
  hint,
  error,
  register,
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  hint?: string;
  error?: string;
  register: ReturnType<ReturnType<typeof useForm>['register']>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} variant="caps">
        {label}{' '}
        {hint && (
          <span className="text-muted normal-case font-normal">({hint})</span>
        )}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        invalid={!!error}
        {...register}
      />
      {error && (
        <span className="text-meta text-danger font-semibold mt-0.5">
          {error}
        </span>
      )}
    </div>
  );
}

function LogoPreview({
  url,
  businessName,
}: {
  url?: string | null;
  businessName: string;
}) {
  const initials = businessName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  if (url) {
    return (
      <div className="h-20 w-20 rounded-md border border-border overflow-hidden bg-surface shrink-0">
        <img
          src={url}
          alt={`Logo de ${businessName}`}
          className="h-full w-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (
              e.currentTarget.parentElement
                ?.querySelector('.logo-fallback') as HTMLElement
            ).style.display = 'flex';
          }}
        />
        <div
          className="logo-fallback h-full w-full items-center justify-center bg-accent-soft text-accent font-bold text-xl hidden"
        >
          {initials}
        </div>
      </div>
    );
  }

  return (
    <div className="h-20 w-20 rounded-md border border-border bg-surface-2 flex items-center justify-center shrink-0">
      <Camera className="h-6 w-6 text-muted" />
    </div>
  );
}
