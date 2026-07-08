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
  customerRepo,
  metaRepo,
  orderRepo,
  syncQueueRepo,
} from '@lavanderpro/db-client';
import type {
  Order,
  Customer,
  Service,
  SyncChange,
  SyncOperation,
  SyncPullResponse,
  SyncPushBatch,
} from '@lavanderpro/shared-types';
import { useNetworkStore } from './network';
import { resolveConflict } from './conflict';

interface SyncStore {
  isSyncing: boolean;
  lastSyncAt: number;
  lastError: string | null;
  pendingCount: number;

  requestSync: () => void;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  fullSync: () => Promise<void>;
  recomputePending: () => Promise<void>;
}

const AUTO_SYNC_DEBOUNCE_MS = 2_000;
const PERIODIC_SYNC_MS = 5 * 60_000; // 5 min

let periodicSyncId: ReturnType<typeof setInterval> | null = null;
let pendingSyncId: ReturnType<typeof setTimeout> | null = null;

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sync API ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  isSyncing: false,
  lastSyncAt: 0,
  lastError: null,
  pendingCount: 0,

  /**
   * Trigger un sync (debounced).
   * Llamar después de cada mutación optimista.
   * Si ya hay un sync en curso, no hace nada.
   * Si está offline, no hace nada.
   */
  requestSync: () => {
    if (typeof window === 'undefined') return;
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

      await apiRequest('/api/sync/batch', {
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
      const res = await apiRequest<SyncPullResponse>(`/api/sync/changes${qs}`);

      // Merge changes con LWW
      for (const change of res.changes) {
        if (change.tombstone) {
          if (change.entity === 'order') await orderRepo.delete(change.entityId);
          else if (change.entity === 'customer') await customerRepo.delete(change.entityId);
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
        } else if (change.entity === 'service') {
          // TODO: serviceRepo cuando exista
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

  recomputePending: async () => {
    const count = await syncQueueRepo.countPending();
    set({ pendingCount: count });
  },
}));

/**
 * Inicializa el sync engine: listeners de network + sync periódico.
 * Llamar una vez al arrancar la app.
 */
export function initSyncEngine(): void {
  if (typeof window === 'undefined') return;
  if (periodicSyncId) return;

  // Cuando vuelve la conexión, sincronizar
  useNetworkStore.subscribe((state, prev) => {
    if (state.state === 'online' && prev.state !== 'online') {
      void useSyncStore.getState().fullSync();
    }
  });

  // Sync periódico
  periodicSyncId = setInterval(() => {
    void useSyncStore.getState().fullSync();
  }, PERIODIC_SYNC_MS);

  // Sync inicial al cargar
  void useSyncStore.getState().recomputePending();
  void useSyncStore.getState().fullSync();
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
