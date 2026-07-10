/**
 * Sync engine — orquesta push + pull + status.
 *
 * Reglas:
 * - push: drena sync_queue → POST /sync/batch → markSynced en éxito
 * - pull: GET /sync/changes?since=lastSync → merge en repos con LWW
 * - Status observable: syncing/idle, lastSyncAt, pendingCount, lastError
 * - Sync es best-effort: nunca throw al caller. Errores se loguean y se
 *   mantienen las ops en queue para retry.
 *
 * Triggers:
 * - requestSync() manual (después de una mutación optimista)
 * - automático cuando network pasa a online
 * - periódico cada X minutos
 */
import { v7 as uuidv7 } from 'uuid';
import { create } from 'zustand';
import {
  categoryRepo,
  customerRepo,
  metaRepo,
  orderRepo,
  serviceRepo,
  syncQueueRepo,
  type ServiceSnapshot,
} from '@lavanderpro/db-client';
import type {
  Order,
  Customer,
  Service,
  ServiceCategory,
  SyncChange,
  SyncOperation,
  SyncPullResponse,
  SyncPushBatch,
} from '@lavanderpro/shared-types';
import { useNetworkStore } from './network';
import { resolveConflict } from './conflict';
import { API_BASE, getAccessToken } from './auth';

interface SyncStore {
  isSyncing: boolean;
  lastSyncAt: number;
  lastError: string | null;
  pendingCount: number;
  /** True si nunca se hizo initial sync para este user (login fresh). */
  needsInitialSync: boolean;

  requestSync: () => void;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  fullSync: () => Promise<void>;
  initialSync: () => Promise<void>;
  recomputePending: () => Promise<void>;
}

const AUTO_SYNC_DEBOUNCE_MS = 2_000;
const PERIODIC_SYNC_MS = 5 * 60_000; // 5 min

let periodicSyncId: ReturnType<typeof setInterval> | null = null;
let pendingSyncId: ReturnType<typeof setTimeout> | null = null;

/**
 * Wrapper de fetch con URL absoluta + Authorization header.
 *
 * Antes hacía `fetch(path)` con path relativo (`/api/sync/...`), que
 * resolvía al MISMO origen del browser (web dev/prod) → 404 porque
 * esas rutas viven en el API. Ahora usa `API_BASE` absoluto (resuelto
 * desde `process.env.NEXT_PUBLIC_API_URL`) y adjunta el JWT.
 *
 * Los paths NO llevan prefijo `/api` — eso lo aporta `API_BASE`.
 */
async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const token = getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sync API ${url} ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  isSyncing: false,
  lastSyncAt: 0,
  lastError: null,
  pendingCount: 0,
  needsInitialSync: true, // true por defecto — se setea false después del primer initialSync

  /**
   * Trigger un sync (debounced).
   * Llamar después de cada mutación optimista.
   * Si ya hay un sync en curso, no hace nada.
   * Si está offline, no hace nada.
   */
  requestSync: () => {
    if (typeof window === 'undefined') return;
    // Si estamos online, sync inmediato (sin debounce). El debounce solo
    // aplica offline — esperamos a que vuelva la conexión para no
    // spammear requests fallidos.
    if (useNetworkStore.getState().state === 'online') {
      if (pendingSyncId) {
        clearTimeout(pendingSyncId);
        pendingSyncId = null;
      }
      void get().fullSync();
      return;
    }
    // Offline: debounced sync — se va a disparar cuando vuelva online
    // (o cuando el heartbeat detecte la transición).
    if (pendingSyncId) clearTimeout(pendingSyncId);
    pendingSyncId = setTimeout(() => {
      void get().fullSync();
    }, AUTO_SYNC_DEBOUNCE_MS);
  },

  push: async () => {
    const { setSyncing, reportSuccess, reportFailure } = useNetworkStore.getState();
    setSyncing(true);
    set({ isSyncing: true });
    try {
      const pending = await syncQueueRepo.getPending();
      if (pending.length === 0) return;

      const operations: SyncOperation[] = pending.map((e) => ({
        uuid: e.uuid,
        entity: e.entity as SyncOperation['entity'],
        entityId: e.entityId,
        op: e.op as SyncOperation['op'],
        payload: e.payload as Record<string, unknown>,
        timestamp: e.timestamp,
      }));

      await apiRequest('/sync/batch', {
        method: 'POST',
        body: JSON.stringify({ operations } satisfies SyncPushBatch),
      });

      await syncQueueRepo.markSynced(pending.map((e) => e.uuid));
      reportSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Push failed';
      set({ lastError: msg });
      reportFailure();
      // No re-throw: best-effort, will retry
      console.warn('[sync] push failed, will retry later:', msg);
    } finally {
      setSyncing(false);
      set({ isSyncing: false });
      await get().recomputePending();
    }
  },

  pull: async () => {
    const { setSyncing, reportSuccess, reportFailure } = useNetworkStore.getState();
    setSyncing(true);
    set({ isSyncing: true });
    try {
      const lastSync = await metaRepo.getLastSync();
      const qs = lastSync > 0 ? `?since=${lastSync}` : '';
      const res = await apiRequest<SyncPullResponse>(`/sync/changes${qs}`);

      // Merge changes con LWW
      for (const change of res.changes) {
        if (change.tombstone) {
          if (change.entity === 'order') await orderRepo.delete(change.entityId);
          else if (change.entity === 'customer') await customerRepo.delete(change.entityId);
          else if (change.entity === 'service_category') {
            // Tombstone = delete. Borramos local para limpiar.
            const snap = await categoryRepo.findById(change.entityId);
            if (snap) await categoryRepo.softDeleteLocal(change.entityId);
          }
          continue;
        }

        if (change.entity === 'order') {
          const local = await orderRepo.getById(change.entityId);
          const remote = change.payload as Order;
          if (!local) {
            await orderRepo.put(remote);
          } else {
            const winner = resolveConflict(local, remote);
            await orderRepo.put(winner);
          }
        } else if (change.entity === 'customer') {
          const local = await customerRepo.getById(change.entityId);
          const remote = change.payload as Customer;
          if (!local) await customerRepo.put(remote);
          else {
            const winner = resolveConflict(local, remote);
            await customerRepo.put(winner);
          }
        } else if (change.entity === 'service_category') {
          const local = await categoryRepo.findById(change.entityId);
          const remote = change.payload as ServiceCategory;
          if (!local) {
            await categoryRepo.put(remote);
          } else {
            const winner = resolveConflict(local, remote);
            await categoryRepo.put(winner);
          }
        } else if (change.entity === 'service') {
          const local = await serviceRepo.findById(change.entityId);
          const remote = change.payload as unknown as ServiceSnapshot;
          if (!local) {
            await serviceRepo.put(remote);
          } else {
            const winner = resolveConflict(local, remote);
            await serviceRepo.put(winner);
          }
        }
      }

      await metaRepo.setLastSync(res.serverTime);
      reportSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Pull failed';
      set({ lastError: msg });
      reportFailure();
      console.warn('[sync] pull failed, will retry later:', msg);
    } finally {
      setSyncing(false);
      set({ isSyncing: false });
      await get().recomputePending();
    }
  },

  fullSync: async () => {
    if (typeof window === 'undefined') return;
    if (get().isSyncing) return;
    if (useNetworkStore.getState().state === 'offline') {
      // Skip — we know we're offline. Caller's mutations are in queue.
      return;
    }
    // Push first, then pull. Order matters: ensures our changes go up first.
    await get().push();
    await get().pull();
    set({ lastSyncAt: Date.now() });
  },

  /**
   * Initial sync — descarga TODO el dataset del tenant al login.
   * Llamar UNA vez al autenticar (después de hydrate).
   *
   * Es un pull completo: ignora `lastSync`, trae todo desde `since=0`,
   * bulkPut en Dexie. Después la UI lee del cache instantáneamente
   * (incluso offline).
   *
   * Solo corre online. Si está offline, marca "needs initial sync"
   * y se triggerea al reconectar.
   */
  initialSync: async () => {
    if (typeof window === 'undefined') return;
    if (useNetworkStore.getState().state === 'offline') {
      // No podemos hacer initial sync offline. Marcar para retry
      // al reconectar.
      set({ needsInitialSync: true });
      return;
    }
    const { setSyncing, reportSuccess, reportFailure } = useNetworkStore.getState();
    setSyncing(true);
    set({ isSyncing: true });
    try {
      // Forzar since=0 → traer todo
      const res = await apiRequest<SyncPullResponse>('/sync/changes?since=0');

      // BulkPut todo. Conflicto LWW aplica (todos los registros son del server
      // así que son más nuevos que la cache vacía).
      for (const change of res.changes) {
        if (change.tombstone) continue;
        if (change.entity === 'order') {
          const remote = change.payload as Order;
          const local = await orderRepo.getById(change.entityId);
          if (!local) await orderRepo.put(remote);
          else {
            const winner = resolveConflict(local, remote);
            await orderRepo.put(winner);
          }
        } else if (change.entity === 'customer') {
          const remote = change.payload as Customer;
          const local = await customerRepo.getById(change.entityId);
          if (!local) await customerRepo.put(remote);
          else {
            const winner = resolveConflict(local, remote);
            await customerRepo.put(winner);
          }
        } else if (change.entity === 'service_category') {
          const remote = change.payload as ServiceCategory;
          await categoryRepo.put(remote);
        } else if (change.entity === 'service') {
          const remote = change.payload as unknown as ServiceSnapshot;
          await serviceRepo.put(remote);
        }
      }

      await metaRepo.setLastSync(res.serverTime);
      set({ lastSyncAt: Date.now(), needsInitialSync: false });
      // eslint-disable-next-line no-console
      console.log(`[sync] initial sync done: ${res.changes.length} changes`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Initial sync failed';
      set({ lastError: msg, needsInitialSync: true });
      reportFailure();
      // eslint-disable-next-line no-console
      console.warn('[sync] initial sync failed, will retry on reconnect:', msg);
    } finally {
      setSyncing(false);
      set({ isSyncing: false });
      await get().recomputePending();
    }
  },

  recomputePending: async () => {
    const count = await syncQueueRepo.countPending();
    set({ pendingCount: count });
  },
}));

/**
 * Inicializa el sync engine: listeners de network + sync periódico.
 * Llamar cuando el usuario está autenticado (NO al arrancar la app).
 *
 * Si el cache local está vacío (primer login, fresh install, o después de
 * logout) → dispara un initialSync que descarga TODO el dataset del tenant.
 * Después, las sync incrementales mantienen la UI al día.
 */
export function initSyncEngine(): void {
  if (typeof window === 'undefined') return;
  if (periodicSyncId) return;

  // Cuando vuelve la conexión, sincronizar inmediatamente.
  useNetworkStore.subscribe((state, prev) => {
    // Si el state transiciona a online y hay queue pendiente, sincronizar
    // ya. Aceptamos syncing → online también (puede pasar si la
    // transición inicial online → online se da justo al montarse).
    if (state.state === 'online' && prev.state !== 'online') {
      if (useSyncStore.getState().needsInitialSync) {
        void useSyncStore.getState().initialSync();
      } else {
        void useSyncStore.getState().fullSync();
      }
    }
  });

  // Sync periódico
  periodicSyncId = setInterval(() => {
    if (useSyncStore.getState().needsInitialSync) {
      void useSyncStore.getState().initialSync();
    } else {
      void useSyncStore.getState().fullSync();
    }
  }, PERIODIC_SYNC_MS);

  // Initial sync al iniciar (si online)
  if (useNetworkStore.getState().state === 'online') {
    void useSyncStore.getState().initialSync();
  }
  // Si está offline al iniciar, marcar para retry al reconectar
  void useSyncStore.getState().recomputePending();
}

export function teardownSyncEngine(): void {
  if (periodicSyncId) {
    clearInterval(periodicSyncId);
    periodicSyncId = null;
  }
  if (pendingSyncId) {
    clearTimeout(pendingSyncId);
    pendingSyncId = null;
  }
}

/**
 * Helper: enqueue + trigger sync. Usar desde los mutators.
 */
export async function enqueueSync(
  entry: Omit<import('@lavanderpro/db-client').SyncQueueEntry, 'uuid' | 'dirty' | 'attempts'>,
): Promise<void> {
  await syncQueueRepo.push({ ...entry, uuid: uuidv7() });
  useSyncStore.getState().requestSync();
}
