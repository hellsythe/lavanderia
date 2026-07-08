/**
 * SyncQueueRepo — operaciones pendientes de sincronizar con el server.
 *
 * Patrón:
 *   1. Mutación optimista: repo.put(order) + syncQueueRepo.push({...})
 *   2. Sync engine drena las pending: syncQueueRepo.getPending() + POST /sync/batch
 *   3. Si OK: markSynced() → no se borran (historial), solo dirty=0
 *   4. Si error: increment attempts + guardamos lastError
 */
import { getDb, type SyncQueueEntry } from '../schema';

const db = () => getDb();

export const syncQueueRepo = {
  /** Añadir nueva operación. uuid es UUID v7 generado en cliente. */
  async push(entry: Omit<SyncQueueEntry, 'dirty' | 'attempts'>): Promise<void> {
    await db().syncQueue.put({
      ...entry,
      attempts: 0,
      dirty: 1,
    });
  },

  /** Todas las pending (dirty=1), ordenadas por timestamp. */
  async getPending(): Promise<SyncQueueEntry[]> {
    return db().syncQueue.where('dirty').equals(1).sortBy('timestamp');
  },

  /** Conteode pendientes. */
  async countPending(): Promise<number> {
    return db().syncQueue.where('dirty').equals(1).count();
  },

  /** Marcar como sincronizadas (dirty=0). NO borra — mantiene historial. */
  async markSynced(uuids: string[]): Promise<void> {
    await db().transaction('rw', db().syncQueue, async () => {
      for (const uuid of uuids) {
        const row = await db().syncQueue.get(uuid);
        if (row) {
          await db().syncQueue.put({ ...row, dirty: 0 });
        }
      }
    });
  },

  /** Incrementar attempts y guardar error. */
  async recordFailure(uuid: string, error: string): Promise<void> {
    const row = await db().syncQueue.get(uuid);
    if (row) {
      await db().syncQueue.put({
        ...row,
        attempts: row.attempts + 1,
        lastError: error,
      });
    }
  },

  /** Borrar historial de operaciones ya sincronizadas (>7 días). */
  async pruneSynced(olderThanMs: number): Promise<void> {
    const cutoff = Date.now() - olderThanMs;
    await db().syncQueue
      .where('dirty')
      .equals(0)
      .and((e) => e.timestamp < cutoff)
      .delete();
  },

  /** Clear all (logout). */
  async clear(): Promise<void> {
    await db().syncQueue.clear();
  },
};
