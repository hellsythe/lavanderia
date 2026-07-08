/**
 * OrderRepo — acceso a la tabla de orders (solo lectura desde repos).
 *
 * apps/web NUNCA debe usar este repo directamente para queries con filtros
 * no indexados. Los filtros disponibles son por id, tenantId, status,
 * customerId. Para queries más complejas, agregar índice en schema.ts
 * y bumpear la version.
 */
import type { Order, OrderStatus } from '@lavanderpro/shared-types';
import { getDb, type OrderSnapshot } from '../schema';

const db = () => getDb();

/** Convierte snapshot de DB → Order del shared-types (shape que consume la UI). */
function toDomain(snap: OrderSnapshot): Order {
  return {
    id: snap.id,
    tenantId: snap.tenantId,
    code: snap.code,
    customerId: snap.customerId,
    customerName: snap.customerName,
    status: snap.status,
    total: snap.total,
    paid: snap.paid,
    balance: snap.balance,
    notes: snap.notes,
    items: snap.items,
    estimatedDeliveryAt: snap.estimatedDeliveryAt,
    deliveredAt: snap.deliveredAt,
    createdAt: snap.createdAt,
    updatedAt: snap.updatedAt,
  };
}

/** Convierte Order del shared-types → snapshot para DB. */
function toSnapshot(order: Order): OrderSnapshot {
  return {
    id: order.id,
    tenantId: order.tenantId,
    code: order.code,
    customerId: order.customerId,
    customerName: order.customerName,
    status: order.status,
    total: order.total,
    paid: order.paid,
    balance: order.balance,
    notes: order.notes,
    items: order.items,
    estimatedDeliveryAt: order.estimatedDeliveryAt,
    deliveredAt: order.deliveredAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export const orderRepo = {
  /** Todas las orders de un tenant, ordenadas por createdAt desc. */
  async getAllByTenant(tenantId: string): Promise<Order[]> {
    const rows = await db()
      .orders.where('tenantId')
      .equals(tenantId)
      .reverse()
      .sortBy('createdAt');
    return rows.map(toDomain);
  },

  /** Filtrar por status dentro de un tenant. */
  async getByStatus(tenantId: string, statuses: OrderStatus[]): Promise<Order[]> {
    const rows = await db()
      .orders.where('[tenantId+status]')
      .anyOf(statuses.map((s) => [tenantId, s]))
      .toArray();
    return rows.map(toDomain);
  },

  /** Una order por id. */
  async getById(id: string): Promise<Order | null> {
    const row = await db().orders.get(id);
    return row ? toDomain(row) : null;
  },

  /**
   * Insertar o actualizar muchas. Usado por el sync engine (pull)
   * y por queries online (después de fetch).
   */
  async bulkPut(orders: Order[]): Promise<void> {
    if (orders.length === 0) return;
    await db().orders.bulkPut(orders.map(toSnapshot));
  },

  /** Upsert de una sola. Usado por mutaciones optimistas. */
  async put(order: Order): Promise<void> {
    await db().orders.put(toSnapshot(order));
  },

  /** Borrar por id. */
  async delete(id: string): Promise<void> {
    await db().orders.delete(id);
  },

  /** Conteos por status (para KPIs del dashboard). */
  async countByStatus(tenantId: string): Promise<Record<OrderStatus, number>> {
    const rows = await db()
      .orders.where('tenantId')
      .equals(tenantId)
      .toArray();
    const counts: Record<OrderStatus, number> = {
      received: 0,
      in_process: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const r of rows) {
      counts[r.status]++;
    }
    return counts;
  },

  /** Clear all orders of a tenant (used on logout). */
  async clearTenant(tenantId: string): Promise<void> {
    await db().orders.where('tenantId').equals(tenantId).delete();
  },
};
