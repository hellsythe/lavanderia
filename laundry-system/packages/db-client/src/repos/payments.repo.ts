/**
 * PaymentRepo — acceso a la tabla de payments (pagos aplicados a pedidos).
 *
 * apps/web NUNCA debe usar este repo directamente sin pasar por las queries.
 * Toda interacción con la DB local va a través de este repo.
 */
import type { Payment } from '@lavanderpro/shared-types';
import { getDb, type PaymentSnapshot } from '../schema';

const db = () => getDb();

/** Snapshot de DB → Payment del shared-types. */
function toDomain(snap: PaymentSnapshot): Payment {
  return {
    id: snap.id,
    tenantId: snap.tenantId,
    orderId: snap.orderId,
    method: snap.method,
    amount: snap.amount,
    reference: snap.reference,
    createdAt: snap.createdAt,
    updatedAt: snap.updatedAt,
  };
}

/** Payment del shared-types → snapshot para DB. */
function toSnapshot(payment: Payment): PaymentSnapshot {
  return {
    id: payment.id,
    tenantId: payment.tenantId,
    orderId: payment.orderId,
    method: payment.method,
    amount: payment.amount,
    reference: payment.reference,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

export const paymentRepo = {
  /** Todos los pagos de un tenant. */
  async getAllByTenant(tenantId: string): Promise<Payment[]> {
    const rows = await db()
      .payments.where('tenantId')
      .equals(tenantId)
      .toArray();
    return rows.map(toDomain);
  },

  /** Pagos de un pedido específico. */
  async getByOrderId(orderId: string): Promise<Payment[]> {
    const rows = await db().payments.where('orderId').equals(orderId).toArray();
    return rows.map(toDomain);
  },

  /** Un pago por id. */
  async getById(id: string): Promise<Payment | null> {
    const row = await db().payments.get(id);
    return row ? toDomain(row) : null;
  },

  /** Upsert de un solo. Usado por mutaciones optimistas. */
  async put(payment: Payment): Promise<void> {
    await db().payments.put(toSnapshot(payment));
  },

  /**
   * Insertar o actualizar muchos. Usado por el sync engine (pull)
   * y por queries online (después de fetch).
   */
  async bulkPut(payments: Payment[]): Promise<void> {
    if (payments.length === 0) return;
    await db().payments.bulkPut(payments.map(toSnapshot));
  },

  /** Borrar por id. */
  async delete(id: string): Promise<void> {
    await db().payments.delete(id);
  },

  /**
   * Suma de pagos de un pedido. Útil para calcular balance local sin
   * requerir conexión.
   */
  async sumByOrderId(orderId: string): Promise<number> {
    const rows = await db().payments.where('orderId').equals(orderId).toArray();
    return rows.reduce((sum, r) => sum + r.amount, 0);
  },

  /** Clear all payments of a tenant (used on logout). */
  async clearTenant(tenantId: string): Promise<void> {
    await db().payments.where('tenantId').equals(tenantId).delete();
  },
};
