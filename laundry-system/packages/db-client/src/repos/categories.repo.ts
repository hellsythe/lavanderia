/**
 * CategoryRepo — CRUD offline-first de ServiceCategory.
 *
 * Patrón: cada mutación aplica local (Dexie) + encola en sync_queue
 * + el sync-engine sube la op cuando hay red (LWW en el server).
 */
import type { CategorySnapshot } from '../schema';
import { getDb } from '../schema';
import { lwwMerge } from '../lib/merge';

const db = () => getDb();

export const categoryRepo = {
  /**
   * Lista categorías del tenant.
   * Por default excluye soft-deleted (deletedAt != null).
   */
  async list(tenantId: string, opts: { includeDeleted?: boolean } = {}): Promise<CategorySnapshot[]> {
    const all = await db().categories.where('tenantId').equals(tenantId).toArray();
    return all
      .filter((c) => opts.includeDeleted || !c.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  },

  async findById(id: string): Promise<CategorySnapshot | null> {
    return (await db().categories.get(id)) ?? null;
  },

  async findByName(name: string, tenantId: string): Promise<CategorySnapshot | null> {
    const all = await db().categories.where('tenantId').equals(tenantId).toArray();
    return all.find((c) => c.name === name && !c.deletedAt) ?? null;
  },

  /**
   * Aplica una categoría desde el server (sync pull).
   * Reemplaza la row local con la del server (LWW ya decidido en server).
   */
  async put(snap: CategorySnapshot): Promise<void> {
    await db().categories.put(snap);
  },

  async bulkPut(snaps: CategorySnapshot[]): Promise<void> {
    await db().categories.bulkPut(snaps);
  },

  /**
   * MERGE con la respuesta del server (sync pull desde la app).
   *
   * A diferencia de `bulkPut`, esto PRESERVA las rows locales que el
   * server no devolvió — esas son las que están pendientes de subir
   * (sync_queue aún no procesada) o que el server no conoce.
   *
   * Estrategia LWW: para cada id presente en local o server, gana el
   * que tenga `updatedAt` más alto. Así, una edición offline con
   * `updatedAt` local > server.updatedAt NO se sobreescribe.
   *
   * Devuelve la lista mergeada (ya filtrada: sin soft-deleted).
   */
  async mergeFromServer(
    tenantId: string,
    serverItems: CategorySnapshot[],
  ): Promise<CategorySnapshot[]> {
    if (serverItems.length > 0) {
      // put = upsert por primary key. NO borra lo que no esté acá.
      await db().categories.bulkPut(serverItems);
    }
    // Releer todo el cache (server upserted + locales intactos) y mergear
    // por LWW. Esto unifica la versión final en el cliente.
    const local = await this.list(tenantId, { includeDeleted: true });
    return lwwMerge(local, serverItems);
  },

  /**
   * Crea una categoría local + encola sync.
   * Devuelve la row creada con su UUID v7.
   */
  async createLocal(input: { tenantId: string; name: string }): Promise<CategorySnapshot> {
    const now = Date.now();
    // Generamos un UUID v7-like (time-ordered) sin dependencia externa.
    const id = generateUuidV7();
    const snap: CategorySnapshot = {
      id,
      tenantId: input.tenantId,
      name: input.name,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db().categories.put(snap);
    return snap;
  },

  /**
   * Actualiza local + encola sync.
   */
  async updateLocal(id: string, patch: Partial<Pick<CategorySnapshot, 'name'>>): Promise<CategorySnapshot> {
    const existing = await db().categories.get(id);
    if (!existing) throw new Error(`Categoría ${id} no encontrada localmente`);
    const updated: CategorySnapshot = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };
    await db().categories.put(updated);
    return updated;
  },

  /**
   * Soft delete local + encola sync.
   * Preserva la row con `deletedAt` para que el server la reconozca como tombstone.
   */
  async softDeleteLocal(id: string): Promise<CategorySnapshot> {
    const existing = await db().categories.get(id);
    if (!existing) throw new Error(`Categoría ${id} no encontrada localmente`);
    const updated: CategorySnapshot = {
      ...existing,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db().categories.put(updated);
    return updated;
  },

  async clear(): Promise<void> {
    await db().categories.clear();
  },
};

/**
 * UUID v7 simplificado: timestamp ms en los primeros 48 bits + random.
 * Suficiente para ordering local + evitar colisiones (probabilísticamente).
 */
function generateUuidV7(): string {
  const ts = Date.now();
  const tsHex = ts.toString(16).padStart(12, '0');
  const rand = crypto.getRandomValues(new Uint8Array(10));
  const randHex = Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-7${randHex.slice(0, 3)}-${randHex.slice(3, 7)}-${randHex.slice(7, 19)}`;
}