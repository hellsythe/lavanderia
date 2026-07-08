'use client';

import { create } from 'zustand';
import type { LoginInput, RegisterInput } from '@lavanderpro/shared-types';
import {
  authApi,
  clearCachedTokens,
  clearSession,
  getAccessToken,
  getRefreshToken,
  persistSession,
  setCachedTokens,
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
      if (snap && userSnap) {
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
      } else if (userSnap) {
        // Sesión online sin PIN — usar directamente
        set({
          user: {
            id: userSnap.id,
            email: userSnap.email,
            name: userSnap.name,
            role: userSnap.role,
            tenantId: userSnap.tenantId,
          },
          tenant: null,
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