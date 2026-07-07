/**
 * Order — pure TS domain entity (no decorators).
 *
 * Single source of truth para tipos: re-exporta desde @lavanderpro/shared-types
 * para mantener 1:1 con el cliente (sync, frontend, etc.).
 *
 * State machine (from DESIGN.md §6 status pills):
 *   received   → in_process | cancelled
 *   in_process → ready     | cancelled
 *   ready      → delivered | cancelled
 *   delivered  → (terminal)
 *   cancelled  → (terminal)
 */
export {
  OrderStatusSchema,
  OrderItemSchema,
  OrderSchema,
  type OrderStatus,
  type OrderItem,
  type Order,
  type ServiceUnit,
} from '@lavanderpro/shared-types';

import type { OrderStatus, OrderItem, Order } from '@lavanderpro/shared-types';

/**
 * Allowed status transitions. Encoded as a state machine so domain logic
 * is enforced regardless of transport (HTTP, sync engine, future WebSocket).
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  received: ['in_process', 'cancelled'],
  in_process: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidOrderTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Transición inválida: ${from} → ${to}`);
    this.name = 'InvalidOrderTransitionError';
  }
}

/**
 * Domain helper — aplica una transición validada.
 * Lanza InvalidOrderTransitionError si no se permite.
 */
export function applyTransition(order: Order, to: OrderStatus): Order {
  if (!canTransition(order.status, to)) {
    throw new InvalidOrderTransitionError(order.status, to);
  }
  const updated: Order = {
    ...order,
    status: to,
    updatedAt: Date.now(),
  };
  if (to === 'delivered') {
    updated.deliveredAt = Date.now();
  }
  return updated;
}

/**
 * Recalcula totales desde los items. El dominio no lo usa automáticamente
 * (lo hace el service al crear/actualizar items), pero queda disponible.
 */
export function recomputeTotals(items: OrderItem[]): { total: number } {
  const total = items.reduce((sum, i) => sum + i.subtotal, 0);
  return { total };
}