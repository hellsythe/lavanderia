/**
 * ServiceRepo — CRUD offline-first de Service.
 *
 * Patrón: cada mutación aplica local (Dexie) + encola en sync_queue
 * + el sync-engine sube la op cuando hay red (LWW en el server).
 */
import type { ServiceSnapshot } from '../schema';
import { getDb } from '../schema';

const db = () => getDb();

export const serviceRepo = {
  /**
   * Lista servicios del tenant. Por default excluye soft-deleted.
   * Opcional: filtrar por categoría y por active.
   */
  async list(
    tenantId: string,
    opts: {
      categoryId?: string;
      onlyActive?: boolean;
      includeDeleted?: boolean;
    } = {},
  ): Promise<ServiceSnapshot[]> {
    const all = await db().services.where('tenantId').equals(tenantId).toArray();
    return all
      .filter((s) => {
        if (!opts.includeDeleted && s.deletedAt) return false;
        if (opts.categoryId && s.categoryId !== opts.categoryId) return false;
        if (opts.onlyActive && !s.active) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  },

  async findById(id: string): Promise<ServiceSnapshot | null> {
    return (await db().services.get(id)) ?? null;
  },

  async findByName(name: string, tenantId: string): Promise<ServiceSnapshot | null> {
    const all = await db().services.where('tenantId').equals(tenantId).toArray();
    return all.find((s) => s.name === name && !s.deletedAt) ?? null;
  },

  /** Aplica un service desde el server (sync pull). */
  async put(snap: ServiceSnapshot): Promise<void> {
    await db().services.put(snap);
  },

  async bulkPut(snaps: ServiceSnapshot[]): Promise<void> {
    await db().services.bulkPut(snaps);
  },

  /**
   * Crea un service local + encola sync.
   * Devuelve la row creada con su UUID v7.
   */
  async createLocal(input: {
    tenantId: string;
    name: string;
    description?: string | null;
    categoryId?: string | null;
    unit: 'kg' | 'piece';
    unitPrice: number;
    minQuantity?: number;
    active?: boolean;
  }): Promise<ServiceSnapshot> {
    const now = Date.now();
    const id = generateUuidV7();
    const snap: ServiceSnapshot = {
      id,
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      unit: input.unit,
      unitPrice: input.unitPrice,
      minQuantity: input.minQuantity ?? 1,
      active: input.active ?? true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db().services.put(snap);
    return snap;
  },

  /**
   * Actualiza local + encola sync.
   * Si el campo no se pasa, conserva el valor existente.
   */
  async updateLocal(
    id: string,
    patch: Partial<
      Pick<
        ServiceSnapshot,
        'name' | 'description' | 'categoryId' | 'unit' | 'unitPrice' | 'minQuantity' | 'active'
      >
    >,
  ): Promise<ServiceSnapshot> {
    const existing = await db().services.get(id);
    if (!existing) throw new Error(`Service ${id} no encontrado localmente`);
    const updated: ServiceSnapshot = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };
    await db().services.put(updated);
    return updated;
  },

  /** Soft delete local + encola sync. Preserva tombstone. */
  async softDeleteLocal(id: string): Promise<ServiceSnapshot> {
    const existing = await db().services.get(id);
    if (!existing) throw new Error(`Service ${id} no encontrado localmente`);
    const updated: ServiceSnapshot = {
      ...existing,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db().services.put(updated);
    return updated;
  },

  async clear(): Promise<void> {
    await db().services.clear();
  },
};

function generateUuidV7(): string {
  const ts = Date.now();
  const tsHex = ts.toString(16).padStart(12, '0');
  const rand = crypto.getRandomValues(new Uint8Array(10));
  const randHex = Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-7${randHex.slice(0, 3)}-${randHex.slice(3, 7)}-${randHex.slice(7, 19)}`;
}