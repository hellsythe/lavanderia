import type { Payment } from '../domain/payment.entity';

/**
 * ListPaymentsFilters — filtros para listar pagos.
 */
export interface ListPaymentsFilters {
  orderId?: string;
  limit?: number;
  offset?: number;
}

export interface ListPaymentsResult {
  items: Payment[];
  total: number;
}

/**
 * Output port — contrato de persistencia de payments.
 * Implementación TypeORM vive en infrastructure/.
 */
export interface PaymentRepositoryPort {
  create(
    payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<Payment, 'id'>>,
  ): Promise<Payment>;

  findById(id: string, tenantId: string): Promise<Payment | null>;

  list(
    tenantId: string,
    filters: ListPaymentsFilters,
  ): Promise<ListPaymentsResult>;

  /** SUM(amount) para un pedido — útil para recalcular paid/balance. */
  sumByOrderId(tenantId: string, orderId: string): Promise<number>;
}

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
