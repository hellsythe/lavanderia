'use client';

import { create } from 'zustand';
import type { LoginInput, RegisterInput } from '@lavanderpro/shared-types';
import {
  authApi,
  clearSession,
  getStoredTenant,
  getStoredUser,
  persistSession,
  type AuthResponse,
} from '~/lib/api-client';

type AuthUser = AuthResponse['user'];
type AuthTenant = AuthResponse['tenant'];

interface AuthState {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error: string | null;
  hydrated: boolean;

  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  status: 'idle',
  error: null,
  hydrated: false,

  hydrate: () => {
    const user = getStoredUser();
    const tenant = getStoredTenant();
    set({ user, tenant, hydrated: true, status: user ? 'authenticated' : 'idle' });
  },

  login: async (input) => {
    set({ status: 'loading', error: null });
    try {
      const data = await authApi.login(input);
      persistSession(data);
      set({
        user: data.user,
        tenant: data.tenant,
        status: 'authenticated',
        error: null,
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
      persistSession(data);
      set({
        user: data.user,
        tenant: data.tenant,
        status: 'authenticated',
        error: null,
      });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Error al crear la cuenta',
      });
      throw err;
    }
  },

  logout: () => {
    clearSession();
    set({ user: null, tenant: null, status: 'idle', error: null });
  },

  clearError: () => set({ error: null }),
}));