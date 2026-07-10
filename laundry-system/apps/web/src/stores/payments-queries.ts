'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentRepo } from '@lavanderpro/db-client';
import {
  enqueueSync,
  useNetworkStore,
} from '@lavanderpro/sync-engine';
import type {
  CreatePaymentInput,
  Payment,
} from '@lavanderpro/shared-types';
import { paymentsApi } from '~/lib/api-client';

/**
 * Hooks de Payments con offline-first semantics.
 *
 * Sigue el mismo patrón que orders: apply local → enqueue sync → best-effort
 * API directo. Se usa en el POS para cobrar al mismo tiempo que se crea
 * el pedido.
 */

export const paymentKeys = {
  all: ['payments'] as const,
  byOrder: (orderId: string) => [...paymentKeys.all, 'order', orderId] as const,
};

/**
 * useCreatePayment — registra un pago.
 *
 * Aplica localmente (Dexie) + enqueue a sync_queue + intenta API directo
 * si online. Devuelve el Payment local (con su UUID).
 */
export function useCreatePayment(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePaymentInput): Promise<Payment> => {
      const now = Date.now();
      const id = input.id ?? crypto.randomUUID();
      const payment: Payment = {
        id,
        tenantId,
        orderId: input.orderId,
        method: input.method,
        amount: input.amount,
        reference: input.reference,
        createdAt: now,
        updatedAt: now,
      };

      // 1. Apply local
      await paymentRepo.put(payment);

      // 2. Enqueue sync (entity 'payment' ya está en SyncEntityTypeSchema)
      await enqueueSync({
        entity: 'payment',
        entityId: payment.id,
        op: 'create',
        payload: payment,
        timestamp: now,
      });

      // 3. Best-effort API con el MISMO id (offline-first). Si el server
      // confirma, merge en el pull posterior. Si falla, la op queda en
      // queue para retry.
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          await paymentsApi.create({ ...input, id: payment.id });
        } catch (e) {
          console.warn('[useCreatePayment] api call failed, will sync later:', e);
        }
      }

      return payment;
    },
    onSuccess: (payment) => {
      qc.invalidateQueries({ queryKey: paymentKeys.all });
      qc.invalidateQueries({ queryKey: paymentKeys.byOrder(payment.orderId) });
    },
  });
}
