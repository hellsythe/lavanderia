/**
 * Payment — pure TS domain entity (re-exporta desde shared-types).
 *
 * Mismo patrón que orders/domain/order.entity.ts: single source of truth
 * para que frontend y backend compartan el tipo sin divergencia.
 */
export {
  PaymentMethodSchema,
  PaymentSchema,
  CreatePaymentInputSchema,
  type PaymentMethod,
  type Payment,
  type CreatePaymentInput,
} from '@lavanderpro/shared-types';
