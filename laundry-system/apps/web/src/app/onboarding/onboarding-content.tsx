'use client';

import {
  Alert,
  Button,
  Input,
  Label,
  Spinner,
} from '@lavanderpro/ui';
import {
  OnboardingNegocioInputSchema,
  OnboardingSucursalInputSchema,
  OnboardingWhatsappInputSchema,
  type OnboardingNegocioInput,
  type OnboardingSucursalInput,
  type OnboardingWhatsappInput,
} from '@lavanderpro/shared-types';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '~/stores/auth-store';
import { OnboardingShell } from '~/components/onboarding-shell';
import { SetupPinModal } from '~/components/setup-pin-modal';

const STEPS = [
  { id: 'negocio', label: 'Negocio' },
  { id: 'sucursal', label: 'Sucursal' },
  { id: 'whatsapp', label: 'WhatsApp' },
] as const;

type StepIdx = 0 | 1 | 2;

/**
 * OnboardingContent — flujo de 3 pasos para configurar el tenant.
 * - Paso 1: Negocio (datos fiscales)
 * - Paso 2: Sucursal (primera ubicación física)
 * - Paso 3: WhatsApp (verificación demo con código 6 dígitos)
 *
 * Al completar paso 3 → SetupPinModal → dashboard.
 */
export function OnboardingContent() {
  const router = useRouter();
  const tenant = useAuth((s) => s.tenant);
  const updateTenantOnboarding = useAuth((s) => s.updateTenantOnboarding);
  const hydrated = useAuth((s) => s.hydrated);

  // Determinar en qué step entrar (basado en el progreso del server).
  const initialStep = useMemo<StepIdx>(() => {
    const step = tenant?.onboardingStep ?? 0;
    if (step >= 3) return 2; // completó → entrar al último (que ya cierra)
    return Math.min(Math.max(step, 0), 2) as StepIdx;
  }, [tenant?.onboardingStep]);

  const [step, setStep] = useState<StepIdx>(initialStep);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPinSetup, setShowPinSetup] = useState(false);

  // Si el tenant ya completó → redirigir.
  useEffect(() => {
    if (!hydrated) return;
    if (tenant?.onboardingCompletedAt) {
      router.replace('/');
    }
  }, [hydrated, tenant?.onboardingCompletedAt, router]);

  // Si no hay tenant todavía (no auth) → el AuthGate nos redirige a /login,
  // pero mientras tanto no renderizamos nada.
  if (!hydrated || !tenant) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center">
        <Spinner size="xl" />
      </main>
    );
  }

  if (showPinSetup) {
    return (
      <SetupPinModal
        onComplete={() => router.push('/')}
        onSkip={() => router.push('/')}
      />
    );
  }

  return (
    <OnboardingShell
      steps={[...STEPS]}
      current={step}
      title="Configura tu lavandería"
      subtitle="3 pasos rápidos para empezar."
    >
      {serverError && (
        <div className="mb-4">
          <Alert variant="error">{serverError}</Alert>
        </div>
      )}

      {step === 0 && (
        <NegocioStep
          submitting={submitting}
          onContinue={async (data) => {
            setSubmitting(true);
            setServerError(null);
            try {
              await updateTenantOnboarding({ step: 1, ...data });
              setStep(1);
            } catch (e) {
              setServerError(e instanceof Error ? e.message : 'Error al guardar');
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}

      {step === 1 && (
        <SucursalStep
          submitting={submitting}
          fiscalAddress={tenant.fiscalAddress}
          onBack={() => setStep(0)}
          onContinue={async (data) => {
            setSubmitting(true);
            setServerError(null);
            try {
              await updateTenantOnboarding({ step: 2, ...data });
              setStep(2);
            } catch (e) {
              setServerError(e instanceof Error ? e.message : 'Error al guardar');
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}

      {step === 2 && (
        <WhatsappStep
          submitting={submitting}
          onBack={() => setStep(1)}
          onComplete={() => setShowPinSetup(true)}
          onSubmit={async (data) => {
            setSubmitting(true);
            setServerError(null);
            try {
              await updateTenantOnboarding({ step: 3, ...data });
              setShowPinSetup(true);
            } catch (e) {
              setServerError(e instanceof Error ? e.message : 'Código incorrecto');
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}
    </OnboardingShell>
  );
}

/* =========================================================================
 * Step 1: Negocio (datos fiscales)
 * ========================================================================= */

function NegocioStep({
  submitting,
  onContinue,
}: {
  submitting: boolean;
  onContinue: (data: OnboardingNegocioInput) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingNegocioInput>({
    resolver: zodResolver(OnboardingNegocioInputSchema),
    defaultValues: { fiscalName: '', fiscalAddress: '', fiscalTaxId: '' },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => void onContinue(data))}
      className="flex flex-col gap-4"
      noValidate
    >
      <fieldset>
        <div className="flex flex-col gap-1.5 mb-3">
          <Label htmlFor="fiscalName" variant="caps">
            Razón social
          </Label>
          <Input
            id="fiscalName"
            placeholder="Lavandería Sol S.A. de C.V."
            invalid={!!errors.fiscalName}
            {...register('fiscalName')}
          />
          {errors.fiscalName && (
            <span className="text-meta text-danger font-semibold mt-0.5">
              {errors.fiscalName.message}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5 mb-3">
          <Label htmlFor="fiscalAddress" variant="caps">
            Dirección fiscal
          </Label>
          <Input
            id="fiscalAddress"
            placeholder="Av. Reforma 123, CDMX"
            invalid={!!errors.fiscalAddress}
            {...register('fiscalAddress')}
          />
          {errors.fiscalAddress && (
            <span className="text-meta text-danger font-semibold mt-0.5">
              {errors.fiscalAddress.message}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fiscalTaxId" variant="caps">
            RFC <span className="text-muted normal-case font-normal">(opcional)</span>
          </Label>
          <Input
            id="fiscalTaxId"
            placeholder="LSO200815ABC"
            invalid={!!errors.fiscalTaxId}
            {...register('fiscalTaxId')}
          />
          {errors.fiscalTaxId && (
            <span className="text-meta text-danger font-semibold mt-0.5">
              {errors.fiscalTaxId.message}
            </span>
          )}
        </div>
      </fieldset>

      <StepActions submitting={submitting} onBack={null} nextLabel="Continuar" />
    </form>
  );
}

/* =========================================================================
 * Step 2: Sucursal
 * ========================================================================= */

function SucursalStep({
  submitting,
  fiscalAddress,
  onBack,
  onContinue,
}: {
  submitting: boolean;
  fiscalAddress?: string | null;
  onBack: () => void;
  onContinue: (data: OnboardingSucursalInput) => Promise<void>;
}) {
  const fiscalAddr = fiscalAddress ?? '';
  const [sameAsFiscal, setSameAsFiscal] = useState(true);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingSucursalInput>({
    resolver: zodResolver(OnboardingSucursalInputSchema),
    defaultValues: {
      branchName: '',
      branchAddress: fiscalAddr,
      branchPhone: '',
      sameAsFiscal: true,
    },
  });

  const branchAddress = watch('branchAddress');

  // Si marca "misma dirección fiscal", autollenar y deshabilitar.
  useEffect(() => {
    if (sameAsFiscal) {
      setValue('branchAddress', fiscalAddr, { shouldValidate: true });
    }
  }, [sameAsFiscal, fiscalAddr, setValue]);

  return (
    <form
      onSubmit={handleSubmit((data) => void onContinue({ ...data, sameAsFiscal }))}
      className="flex flex-col gap-4"
      noValidate
    >
      <fieldset>
        <div className="flex flex-col gap-1.5 mb-3">
          <Label htmlFor="branchName" variant="caps">
            Nombre de la sucursal
          </Label>
          <Input
            id="branchName"
            placeholder="Sucursal Centro"
            invalid={!!errors.branchName}
            {...register('branchName')}
          />
          {errors.branchName && (
            <span className="text-meta text-danger font-semibold mt-0.5">
              {errors.branchName.message}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5 mb-3">
          <Label htmlFor="branchAddress" variant="caps">
            Dirección
          </Label>
          <Input
            id="branchAddress"
            placeholder="Av. Reforma 123, CDMX"
            invalid={!!errors.branchAddress}
            disabled={sameAsFiscal}
            {...register('branchAddress')}
            value={branchAddress ?? ''}
          />
          {errors.branchAddress && (
            <span className="text-meta text-danger font-semibold mt-0.5">
              {errors.branchAddress.message}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5 mb-3">
          <Label htmlFor="branchPhone" variant="caps">
            Teléfono
          </Label>
          <Input
            id="branchPhone"
            type="tel"
            placeholder="55 1234 5678"
            invalid={!!errors.branchPhone}
            {...register('branchPhone')}
          />
          {errors.branchPhone && (
            <span className="text-meta text-danger font-semibold mt-0.5">
              {errors.branchPhone.message}
            </span>
          )}
        </div>

        <label className="flex items-center gap-2 text-meta text-fg cursor-pointer select-none mt-1">
          <input
            type="checkbox"
            checked={sameAsFiscal}
            onChange={(e) => setSameAsFiscal(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
          />
          <span>Misma dirección fiscal</span>
        </label>
      </fieldset>

      <StepActions submitting={submitting} onBack={onBack} nextLabel="Continuar" />
    </form>
  );
}

/* =========================================================================
 * Step 3: WhatsApp (verificación demo)
 * ========================================================================= */

function WhatsappStep({
  submitting,
  onBack,
  onSubmit,
}: {
  submitting: boolean;
  onBack: () => void;
  onComplete: () => void;
  onSubmit: (data: OnboardingWhatsappInput) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OnboardingWhatsappInput>({
    resolver: zodResolver(OnboardingWhatsappInputSchema),
    defaultValues: { whatsappPhone: '', whatsappCode: '' },
  });

  const phone = watch('whatsappPhone') ?? '';
  const expected = useMemo(() => {
    const digits = phone.replace(/\D/g, '');
    return digits.slice(-6).padStart(6, '0');
  }, [phone]);

  // Countdown reenvío (demo): 30s después de pedir el código.
  const [resendCountdown, setResendCountdown] = useState(30);
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  return (
    <form
      onSubmit={handleSubmit((data) => void onSubmit(data))}
      className="flex flex-col gap-4"
      noValidate
    >
      <p className="text-meta text-muted">
        Te enviaremos un código de 6 dígitos por WhatsApp para confirmar tu número.
      </p>

      <fieldset>
        <div className="flex flex-col gap-1.5 mb-3">
          <Label htmlFor="whatsappPhone" variant="caps">
            Número de WhatsApp
          </Label>
          <Input
            id="whatsappPhone"
            type="tel"
            placeholder="52 55 1234 5678"
            invalid={!!errors.whatsappPhone}
            {...register('whatsappPhone')}
          />
          {errors.whatsappPhone && (
            <span className="text-meta text-danger font-semibold mt-0.5">
              {errors.whatsappPhone.message}
            </span>
          )}
        </div>

        {expected.length === 6 && (
          <div className="mb-3 p-3 bg-info-soft rounded-sm">
            <p className="text-meta text-info font-semibold">
              Demo · Tu código es: <span className="font-mono num tracking-wider">{expected}</span>
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="whatsappCode" variant="caps">
            Código de verificación
          </Label>
          <input
            id="whatsappCode"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="w-full max-w-[160px] h-10 text-center text-[18px] font-bold tracking-[0.4em] num bg-surface-2 text-fg border border-border rounded-sm outline-none focus:bg-surface focus:border-accent focus:shadow-focus-ring transition-colors duration-ui"
            autoComplete="one-time-code"
            {...register('whatsappCode')}
          />
          {errors.whatsappCode && (
            <span className="text-meta text-danger font-semibold mt-0.5">
              {errors.whatsappCode.message}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setResendCountdown(30)}
          disabled={resendCountdown > 0}
          className="mt-3 inline-flex items-center gap-1.5 text-meta text-accent font-bold disabled:text-muted disabled:cursor-not-allowed hover:underline transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${resendCountdown > 0 ? '' : ''}`} />
          {resendCountdown > 0
            ? `Reenviar código en ${resendCountdown}s`
            : 'Reenviar código'}
        </button>
      </fieldset>

      <StepActions submitting={submitting} onBack={onBack} nextLabel="Verificar y continuar" />
    </form>
  );
}

/* =========================================================================
 * Acciones del step (footer con Atrás / Continuar)
 * ========================================================================= */

function StepActions({
  submitting,
  onBack,
  nextLabel,
}: {
  submitting: boolean;
  onBack: (() => void) | null;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-4 border-t border-border">
      {onBack ? (
        <Button type="button" variant="secondary" size="md" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Atrás
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" size="md" disabled={submitting}>
        {submitting ? (
          <>
            <Spinner size="sm" tone="inverse" />
            Guardando…
          </>
        ) : (
          <>
            {nextLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </>
        )}
      </Button>
    </div>
  );
}