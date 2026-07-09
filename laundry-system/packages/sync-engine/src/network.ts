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
  // Empezamos en 'offline' hasta confirmar. Esto evita el flash del banner
  // cuando `navigator.onLine` retorna `false` por extensiones o configuración
  // del browser pero en realidad hay red. El recheck inmediato en `init()`
  // confirma el estado real.
  state: 'offline',
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

    // Recheck INMEDIATO para confirmar el estado real de la red.
    // Sin esto, el banner aparece durante los primeros 30s en localhost
    // si el browser no detecta la red correctamente.
    void get().recheck();

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
      // Ping a un archivo estático del mismo origen. NO al backend.
// Razón: el detector de online/offline debe responder a "¿tengo red?",
// no a "¿mi API responde?". Son ortogonales: puedes tener WiFi con el
// API caído, o sin backend en dev local — en ambos casos la red está OK.
// La salud del API la verifica el sync engine antes de cada POST/PULL,
// no este heartbeat.
//
// `/manifest.json` existe en dev (`next dev` sirve `public/`) y en prod
// (nginx sirviendo `out/`), y es brand-neutral.
      const healthUrl = '/manifest.json';
      const res = await fetch(healthUrl, {
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
