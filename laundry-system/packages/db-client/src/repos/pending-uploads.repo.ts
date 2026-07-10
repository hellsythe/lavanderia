/**
 * PendingUploadRepo — acceso a la tabla de archivos pendientes de subir
 * a MinIO/S3. Útil para logos offline: el blob se guarda en IndexedDB
 * y el sync engine lo drena cuando vuelve la conexión.
 */
import { getDb, type PendingUpload } from '../schema';

const db = () => getDb();

export const pendingUploadRepo = {
  /** Lista todos los pendientes que no han sido completados aún. */
  async listAll(): Promise<PendingUpload[]> {
    return db()
      .pendingUploads.filter((r) => r.dirty === 1)
      .sortBy('createdAt');
  },
  /** Lista todos los pendientes de un tenant, ordenados por createdAt. */
  async list(tenantId: string): Promise<PendingUpload[]> {
    return db()
      .pendingUploads.where('tenantId')
      .equals(tenantId)
      .filter((r) => r.dirty === 1)
      .sortBy('createdAt');
  },

  /** Guarda una subida pendiente. */
  async push(entry: Omit<PendingUpload, 'id' | 'attempts' | 'dirty'>): Promise<void> {
    await db().pendingUploads.put({
      ...entry,
      id: crypto.randomUUID(),
      attempts: 0,
      dirty: 1,
    });
  },

  /** Cuenta pendientes (para el dashboard del sync engine). */
  async count(tenantId: string): Promise<number> {
    return db()
      .pendingUploads.where('tenantId')
      .equals(tenantId)
      .filter((r) => r.dirty === 1)
      .count();
  },

  /** Marca como completado (después de upload exitoso). */
  async markDone(id: string): Promise<void> {
    await db().pendingUploads.update(id, { dirty: 0 });
  },

  /** Incrementa attempts y guarda lastError. */
  async markFailed(id: string, errorMessage: string): Promise<void> {
    const row = await db().pendingUploads.get(id);
    if (!row) return;
    await db().pendingUploads.update(id, {
      attempts: (row.attempts ?? 0) + 1,
      lastError: errorMessage,
    });
  },

  /** Borra un pendiente (cleanup). */
  async delete(id: string): Promise<void> {
    await db().pendingUploads.delete(id);
  },

  /** Clear all of a tenant (logout). */
  async clearTenant(tenantId: string): Promise<void> {
    await db().pendingUploads.where('tenantId').equals(tenantId).delete();
  },
};
