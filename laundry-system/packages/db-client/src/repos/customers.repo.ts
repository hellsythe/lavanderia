/**
 * CustomerRepo — clientes cacheados.
 * Para MVP, usamos la misma entidad del shared-types.
 */
import type { Customer } from '@lavanderpro/shared-types';
import { getDb, type CustomerSnapshot } from '../schema';

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
    createdAt: 0, // Customer no tiene createdAt en shared-types — usar updatedAt
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
    updatedAt: c.updatedAt,
  };
}

export const customerRepo = {
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

  async put(customer: Customer): Promise<void> {
    await db().customers.put(toSnapshot(customer));
  },

  async delete(id: string): Promise<void> {
    await db().customers.delete(id);
  },

  async clearTenant(tenantId: string): Promise<void> {
    await db().customers.where('tenantId').equals(tenantId).delete();
  },
};
