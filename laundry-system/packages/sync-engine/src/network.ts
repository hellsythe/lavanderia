/**
 * Network detection — online/offline observable.
 *
 * Combina `navigator.onLine` (no muy confiable) con heartbeats al backend
 * (más confiable). Si el heartbeat falla, asumimos offline.
 */
import { create } from 'zustand';

export type NetworkState = 'online' | 'offline' | 'syncing';

interface NetworkStore {
  state: NetworkState;
  lastHeartbeat: number;
  /** Inicializa los listeners (idempotente). */
  init: () => void;
  /** Llamar cuando arranca/termina un sync. */
  setSyncing: (syncing: boolean) => void;
  /** Llamar cuando llega respuesta del backend. */
  reportSuccess: () => void;
  /** Llamar cuando falla una request. */
  reportFailure: () => void;
  /** Force a manual recheck. */
  recheck: () => Promise<void>;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 5_000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let inited = false;

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  state: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  lastHeartbeat: 0,

  init: () => {
    if (inited || typeof window === 'undefined') return;
    inited = true;

    window.addEventListener('online', () => {
      // Browser says online → recheck
      void get().recheck();
    });
    window.addEventListener('offline', () => {
      set({ state: 'offline' });
    });

    intervalId = setInterval(() => {
      void get().recheck();
    }, HEARTBEAT_INTERVAL_MS);
  },

  setSyncing: (syncing) => {
    set((s) => ({
      state: syncing ? 'syncing' : s.state === 'syncing' ? 'online' : s.state,
    }));
  },

  reportSuccess: () => {
    set({ state: 'online', lastHeartbeat: Date.now() });
  },

  reportFailure: () => {
    set({ state: 'offline' });
  },

  recheck: async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ state: 'offline' });
      return;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
      const res = await fetch('/api/health', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        set({ state: 'online', lastHeartbeat: Date.now() });
      } else {
        set({ state: 'offline' });
      }
    } catch {
      set({ state: 'offline' });
    }
  },
}));

/**
 * Limpia el interval. Llamar en logout o cleanup.
 */
export function teardownNetworkDetection(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  inited = false;
}
