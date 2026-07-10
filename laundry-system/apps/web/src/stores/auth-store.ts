'use client';

import { create } from 'zustand';
import type {
  LoginInput,
  OnboardingStepInput,
  RegisterInput,
  Tenant,
} from '@lavanderpro/shared-types';
import {
  authApi,
  clearCachedTokens,
  clearSession,
  getAccessToken,
  getRefreshToken,
  persistSession,
  setCachedTokens,
  tenantsApi,
} from '~/lib/api-client';
import { authGate } from '~/lib/auth-gate';

type AuthUser = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
};
type AuthTenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  // Campos del onboarding — se rellenan tras completar cada paso.
  // `null` cuando aún no se completó ese paso.
  fiscalName?: string | null;
  fiscalAddress?: string | null;
  fiscalTaxId?: string | null;
  branchName?: string | null;
  branchAddress?: string | null;
  branchPhone?: string | null;
  whatsappPhone?: string | null;
  whatsappVerifiedAt?: number | null;
  logoUrl?: string | null;
  onboardingStep?: number;
  onboardingCompletedAt?: number;
};

interface AuthState {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error: string | null;
  hydrated: boolean;
  pinSetup: boolean;
  pinUnlocked: boolean;
  requiresOnlineReauth: boolean;
  failedPinAttempts: number;

  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => void;
  clearError: () => void;
  setupPin: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<{ ok: boolean }>;
  unlockWithBiometric: () => Promise<{ ok: boolean }>;
  /**
   * Aplica un paso del onboarding al tenant actual.
   * Actualiza el `tenant` en el store con la respuesta del server.
   * El caller debe haber validado con Zod antes (usamos zodResolver en el form).
   */
  updateTenantOnboarding: (input: OnboardingStepInput) => Promise<Tenant>;
  /** Actualiza datos del tenant (configuración general, logo, etc). */
  updateTenant: (input: import('@lavanderpro/shared-types').UpdateTenantInput) => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  tenant: null,
  status: 'idle',
  error: null,
  hydrated: false,
  pinSetup: false,
  pinUnlocked: false,
  requiresOnlineReauth: false,
  failedPinAttempts: 0,

  hydrate: () => {
    // Verifica si hay sesión en IndexedDB y si está unlocked
    void (async () => {
      const { authSessionRepo } = await import('@lavanderpro/db-client');
      const { userRepo } = await import('@lavanderpro/db-client');
      const snap = await authSessionRepo.get();
      const userSnap = await userRepo.getCurrent();

      // Helper para reconstruir el `tenant` desde userRepo cuando no hay
      // sesión encriptada (caso típico: register fresh, antes de setupPin).
      const tenantFromUser = userSnap
        ? {
            id: userSnap.tenantId,
            name: userSnap.tenantName,
            slug: userSnap.tenantSlug ?? '',
            plan: userSnap.tenantPlan,
          }
        : null;

      if (snap && userSnap) {
        // Sesión encriptada con PIN — requiere unlock
        set({
          user: {
            id: userSnap.id,
            email: userSnap.email,
            name: userSnap.name,
            role: userSnap.role,
            tenantId: userSnap.tenantId,
          },
          tenant: {
            id: snap.tenant.id,
            name: snap.tenant.name,
            slug: snap.tenant.slug,
            plan: snap.tenant.plan,
          },
          pinSetup: true,
          pinUnlocked: false, // necesita unlock cada vez
          status: 'idle',
          requiresOnlineReauth: await authGate.needsOnlineReauth(),
        });
      } else if (userSnap && tenantFromUser) {
        // Sesión online sin PIN — usar directamente, reconstruir tenant
        // desde userRepo. NO nullear tenant: rompe el flujo de onboarding
        // si acaba de registrarse y refresca la página.
        set({
          user: {
            id: userSnap.id,
            email: userSnap.email,
            name: userSnap.name,
            role: userSnap.role,
            tenantId: userSnap.tenantId,
          },
          tenant: tenantFromUser,
          pinSetup: false,
          pinUnlocked: true, // sin PIN, sesión "always unlocked"
          status: 'authenticated',
        });
      } else {
        set({ status: 'idle' });
      }
      set({ hydrated: true });
    })();
  },

  login: async (input) => {
    set({ status: 'loading', error: null });
    try {
      const data = await authApi.login(input);
      setCachedTokens(data.tokens.accessToken, data.tokens.refreshToken);
      set({
        user: data.user,
        tenant: data.tenant,
        status: 'authenticated',
        error: null,
      });
      // Guardar user snapshot en IndexedDB
      const { userRepo } = await import('@lavanderpro/db-client');
      await userRepo.setCurrent({
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        tenantId: data.user.tenantId,
        tenantName: data.tenant.name,
        tenantPlan: data.tenant.plan,
        tenantSlug: data.tenant.slug,
      });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Error al iniciar sesión',
      });
      throw err;
    }
  },

  register: async (input) => {
    set({ status: 'loading', error: null });
    try {
      const data = await authApi.register(input);
      setCachedTokens(data.tokens.accessToken, data.tokens.refreshToken);
      set({
        user: data.user,
        tenant: data.tenant,
        status: 'authenticated',
        error: null,
      });
      const { userRepo } = await import('@lavanderpro/db-client');
      await userRepo.setCurrent({
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        tenantId: data.user.tenantId,
        tenantName: data.tenant.name,
        tenantPlan: data.tenant.plan,
        tenantSlug: data.tenant.slug,
      });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Error al crear la cuenta',
      });
      throw err;
    }
  },

  logout: async () => {
    await clearSession();
    set({
      user: null,
      tenant: null,
      status: 'idle',
      error: null,
      pinUnlocked: false,
    });
  },

  setupPin: async (pin: string) => {
    const { userRepo, authSessionRepo } = await import('@lavanderpro/db-client');
    const userSnap = await userRepo.getCurrent();
    if (!userSnap) throw new Error('No user logged in');
    // Usar los tokens que ya están en memoria (de fresh login o unlock).
    const access = getAccessToken();
    const refresh = getRefreshToken();
    if (!access || !refresh) {
      throw new Error('Sesión expirada. Inicia sesión de nuevo.');
    }
    await authGate.setupPin(pin, access, refresh, userSnap, {
      id: userSnap.tenantId,
      name: userSnap.tenantName,
      slug: '',
      plan: userSnap.tenantPlan,
    });
    set({ pinSetup: true, pinUnlocked: true });
  },

  unlockWithPin: async (pin: string) => {
    set({ error: null });
    const result = await authGate.unlockWithPin(pin);
    if (!result.ok) {
      const { failedAttemptsRepo } = await import('@lavanderpro/db-client');
      const count = await failedAttemptsRepo.getCount();
      set({ failedPinAttempts: count, error: pinErrorMessage(result.reason) });
      if (result.reason === 'rate-limited') {
        // Wipe local
        await get().logout();
        return { ok: false };
      }
      return { ok: false };
    }
    setCachedTokens(result.accessToken!, result.refreshToken!);
    set({ pinUnlocked: true, failedPinAttempts: 0, error: null });
    return { ok: true };
  },

  unlockWithBiometric: async () => {
    const result = await authGate.unlockWithBiometric();
    if (!result.ok) {
      set({ error: 'Biometría falló. Intenta de nuevo o usa tu PIN.' });
      return { ok: false };
    }
    if (result.refreshToken) {
      // El access token encriptado se queda en cache. En producción,
      // biometric desencripta via secure element. En web, fallback a PIN.
      set({ pinUnlocked: true, error: null });
    }
    return { ok: true };
  },

  clearError: () => set({ error: null }),

  updateTenantOnboarding: async (input) => {
    const { tenant } = get();
    if (!tenant) {
      throw new Error('No hay tenant activo');
    }
    const updated = await tenantsApi.updateOnboarding(tenant.id, input);
    set({
      tenant: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        plan: updated.plan,
        fiscalName: updated.fiscalName ?? null,
        fiscalAddress: updated.fiscalAddress ?? null,
        branchName: updated.branchName ?? null,
        branchAddress: updated.branchAddress ?? null,
        branchPhone: updated.branchPhone ?? null,
        whatsappPhone: updated.whatsappPhone ?? null,
        whatsappVerifiedAt: updated.whatsappVerifiedAt ?? null,
        onboardingStep: updated.onboardingStep,
        onboardingCompletedAt: updated.onboardingCompletedAt,
      },
    });
    return updated;
  },

  updateTenant: async (input) => {
    const { tenant } = get();
    if (!tenant) throw new Error('No hay tenant activo');
    const updated = await tenantsApi.update(tenant.id, input);
    set((s) => ({
      tenant: s.tenant
        ? {
            ...s.tenant,
            name: updated.name ?? s.tenant.name,
            fiscalName: updated.fiscalName ?? s.tenant.fiscalName,
            fiscalAddress: updated.fiscalAddress ?? s.tenant.fiscalAddress,
            fiscalTaxId: updated.fiscalTaxId ?? s.tenant.fiscalTaxId,
            branchName: updated.branchName ?? s.tenant.branchName,
            branchAddress: updated.branchAddress ?? s.tenant.branchAddress,
            branchPhone: updated.branchPhone ?? s.tenant.branchPhone,
            whatsappPhone: updated.whatsappPhone ?? s.tenant.whatsappPhone,
            logoUrl: updated.logoUrl ?? s.tenant.logoUrl,
          }
        : null,
    }));
  },
}));

function pinErrorMessage(reason: string | undefined): string {
  switch (reason) {
    case 'wrong-pin':
      return 'PIN incorrecto. Verifica e intenta de nuevo.';
    case 'rate-limited':
      return 'Demasiados intentos. La sesión local fue borrada. Inicia sesión online.';
    case 'no-pin':
      return 'No hay PIN configurado. Inicia sesión online primero.';
    case 'no-biometric':
      return 'Biometría no configurada.';
    case 'biometric-failed':
      return 'Autenticación biométrica falló.';
    default:
      return 'No se pudo desbloquear la sesión.';
  }
}