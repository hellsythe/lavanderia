/**
 * CustomerRepo — clientes cacheados (offline-first).
 *
 * Reads:
 *   - getAllByTenant / getById / bulkPut — usados por el sync engine
 *     para popular el cache local desde el server.
 *
 * Writes:
 *   - createLocal: crea row con UUID v7 + encola sync.
 *   - updateLocal: aplica patch + encola sync.
 *   - softDeleteLocal: tombstone + encola sync.
 */
import type { Customer } from '@lavanderpro/shared-types';
import { getDb, type CustomerSnapshot } from '../schema';
import { lwwMerge } from '../lib/merge';

const db = () => getDb();

function toDomain(snap: CustomerSnapshot): Customer {
  return {
    id: snap.id,
    tenantId: snap.tenantId,
    name: snap.name,
    phone: snap.phone,
    email: snap.email,
    address: snap.address,
    notes: snap.notes,
    rfc: snap.rfc,
    legalName: snap.legalName,
    createdAt: snap.createdAt ?? snap.updatedAt,
    updatedAt: snap.updatedAt,
  };
}

function toSnapshot(c: Customer): CustomerSnapshot {
  return {
    id: c.id,
    tenantId: c.tenantId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    notes: c.notes,
    rfc: c.rfc,
    legalName: c.legalName,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export const customerRepo = {
  // === Reads (existentes) ===

  async getAllByTenant(tenantId: string): Promise<Customer[]> {
    const rows = await db()
      .customers.where('tenantId')
      .equals(tenantId)
      .sortBy('name');
    return rows.map(toDomain);
  },

  async getById(id: string): Promise<Customer | null> {
    const row = await db().customers.get(id);
    return row ? toDomain(row) : null;
  },

  async bulkPut(customers: Customer[]): Promise<void> {
    if (customers.length === 0) return;
    await db().customers.bulkPut(customers.map(toSnapshot));
  },

  /**
   * MERGE con la respuesta del server (sync pull desde la app).
   *
   * Preserva las rows locales que el server no devolvió (offline-
   * pending). LWW por `updatedAt` para que ediciones offline con
   * `updatedAt` local > server no se sobreescriban.
   *
   * Devuelve la lista mergeada (sin soft-deleted).
   */
  async mergeFromServer(
    tenantId: string,
    serverItems: Customer[],
  ): Promise<Customer[]> {
    if (serverItems.length > 0) {
      await db().customers.bulkPut(serverItems.map(toSnapshot));
    }
    const localSnapshots = await db()
      .customers.where('tenantId')
      .equals(tenantId)
      .toArray();
    const mergedSnapshots = lwwMerge(localSnapshots, serverItems.map(toSnapshot));
    return mergedSnapshots
      .filter((c) => !c.deletedAt)
      .map(toDomain)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  },

  async put(customer: Customer): Promise<void> {
    await db().customers.put(toSnapshot(customer));
  },

  async delete(id: string): Promise<void> {
    await db().customers.delete(id);
  },

  async clearTenant(tenantId: string): Promise<void> {
    await db().customers.where('tenantId').equals(tenantId).delete();
  },

  // === Writes offline-first (consumidos por customers-queries) ===

  /**
   * Crea un customer local con UUID v7 + enqueue sync (lo hace el caller).
   * Devuelve la row creada.
   */
  async createLocal(input: {
    tenantId: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    rfc?: string;
    legalName?: string;
  }): Promise<CustomerSnapshot> {
    const now = Date.now();
    const id = generateUuidV7();
    const snap: CustomerSnapshot = {
      id,
      tenantId: input.tenantId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      notes: input.notes,
      rfc: input.rfc,
      legalName: input.legalName,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db().customers.put(snap);
    return snap;
  },

  /**
   * Actualiza local + enqueue sync (lo hace el caller).
   * Solo aplica los campos provistos; el resto se preserva.
   */
  async updateLocal(
    id: string,
    patch: Partial<
      Pick<
        CustomerSnapshot,
        | 'name'
        | 'phone'
        | 'email'
        | 'address'
        | 'notes'
        | 'rfc'
        | 'legalName'
      >
    >,
  ): Promise<CustomerSnapshot> {
    const existing = await db().customers.get(id);
    if (!existing) throw new Error(`Customer ${id} no encontrado localmente`);
    const updated: CustomerSnapshot = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };
    await db().customers.put(updated);
    return updated;
  },

  /** Soft delete local — preserva tombstone para sync. */
  async softDeleteLocal(id: string): Promise<CustomerSnapshot> {
    const existing = await db().customers.get(id);
    if (!existing) throw new Error(`Customer ${id} no encontrado localmente`);
    const updated: CustomerSnapshot = {
      ...existing,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db().customers.put(updated);
    return updated;
  },

  async clear(): Promise<void> {
    await db().customers.clear();
  },
};

function generateUuidV7(): string {
  const ts = Date.now();
  const tsHex = ts.toString(16).padStart(12, '0');
  const rand = crypto.getRandomValues(new Uint8Array(10));
  const randHex = Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-7${randHex.slice(0, 3)}-${randHex.slice(3, 7)}-${randHex.slice(7, 19)}`;
}