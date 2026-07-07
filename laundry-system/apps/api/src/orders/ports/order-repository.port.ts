import type { Order, OrderStatus } from '../domain/order.entity';

export interface ListOrdersFilters {
  status?: OrderStatus[];
  customerId?: string;
  /** ISO timestamp ms */
  updatedSince?: number;
  limit?: number;
  offset?: number;
}

export interface ListOrdersResult {
  items: Order[];
  total: number;
}

/**
 * Output port — contrato de persistencia de orders.
 * Implementación TypeORM vive en infrastructure/.
 */
export interface OrderRepositoryPort {
  create(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'code'>): Promise<Order>;
  findById(id: string, tenantId: string): Promise<Order | null>;
  findByCode(code: string, tenantId: string): Promise<Order | null>;
  list(tenantId: string, filters: ListOrdersFilters): Promise<ListOrdersResult>;
  save(order: Order): Promise<Order>;
  /** Devuelve el siguiente número correlativo del tenant: ORD-0001, ORD-0002... */
  nextOrderCode(tenantId: string): Promise<string>;
  /** Conteos por status — para KPIs del dashboard */
  countByStatus(tenantId: string): Promise<Record<OrderStatus, number>>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');