'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orderRepo } from '@lavanderpro/db-client';
import {
  enqueueSync,
  useNetworkStore,
  useSyncStore,
} from '@lavanderpro/sync-engine';
import type {
  CreateOrderInput,
  Order,
  OrderStatus,
} from '@lavanderpro/shared-types';
import {
  ordersApi,
  type ListOrdersParams,
  type ListOrdersResponse,
} from '~/lib/api-client';

/**
 * Hooks de Orders con offline-first semantics.
 *
 * Reads:
 *   1. Si online → fetch del API + actualiza cache local
 *   2. Si offline o falla → devuelve cache local (filtrado por tenantId)
 *
 * Writes:
 *   1. Apply optimístico al cache local (UI actualiza inmediato)
 *   2. Enqueue a sync_queue
 *   3. Trigger sync (fire-and-forget)
 *
 * `tenantId` se pasa al hook para filtrar el cache local.
 * NO se envía al server — el server lo extrae del JWT.
 */

export const orderKeys = {
  all: ['orders'] as const,
  list: (params: ListOrdersParams & { tenantId?: string }) =>
    [...orderKeys.all, 'list', params] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
  counts: () => [...orderKeys.all, 'counts'] as const,
};

interface UseOrdersParams extends ListOrdersParams {
  tenantId?: string;
}

export function useOrders(params: UseOrdersParams = {}) {
  const { tenantId, ...apiParams } = params;
  return useQuery<Order[]>({
    queryKey: orderKeys.list(params),
    queryFn: async (): Promise<Order[]> => {
      // Si online: intentar fetch + actualizar cache
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          const response: ListOrdersResponse = await ordersApi.list(apiParams);
          await orderRepo.bulkPut(response.items);
          return response.items;
        } catch (e) {
          console.warn('[useOrders] fetch failed, using cache:', e);
          if (!tenantId) return [];
          if (apiParams.status?.length) {
            return orderRepo.getByStatus(tenantId, apiParams.status);
          }
          return orderRepo.getAllByTenant(tenantId);
        }
      }
      // Offline: leer cache
      if (!tenantId) return [];
      const all = await orderRepo.getAllByTenant(tenantId);
      if (apiParams.status?.length) {
        return all.filter((o) => apiParams.status!.includes(o.status));
      }
      return all;
    },
    staleTime: 30_000,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn: async (): Promise<Order | null> => {
      if (!id) return null;
      return orderRepo.getById(id);
    },
    enabled: !!id,
  });
}

export function useOrderCounts(tenantId?: string) {
  return useQuery({
    queryKey: orderKeys.counts(),
    queryFn: async () => {
      // Intentar API primero
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          return await ordersApi.counts();
        } catch (e) {
          console.warn('[useOrderCounts] fetch failed, using cache:', e);
          // Fallback a cache
          if (tenantId) return orderRepo.countByStatus(tenantId);
        }
      }
      return tenantId ? orderRepo.countByStatus(tenantId) : {} as Record<OrderStatus, number>;
    },
    staleTime: 30_000,
  });
}

export function useChangeOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: OrderStatus;
    }): Promise<Order> => {
      // Apply optimistic localmente
      const existing = await orderRepo.getById(id);
      if (!existing) throw new Error(`Order ${id} not found locally`);

      const updated: Order = {
        ...existing,
        status,
        updatedAt: Date.now(),
        deliveredAt:
          status === 'delivered' ? Date.now() : existing.deliveredAt,
      };
      await orderRepo.put(updated);

      // Enqueue sync (fire-and-forget)
      await enqueueSync({
        entity: 'order',
        entityId: id,
        op: 'update',
        payload: updated,
        timestamp: Date.now(),
      });

      // Best-effort: intentar API directo también (si online)
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          await ordersApi.changeStatus(id, status);
        } catch (e) {
          console.warn('[useChangeOrderStatus] api call failed, will sync later:', e);
        }
      }

      return updated;
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.setQueryData(orderKeys.detail(order.id), order);
    },
  });
}

export function useCreateOrder(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrderInput): Promise<Order> => {
      // Para MVP, simulamos creación local. En fase siguiente, el backend
      // generará el ID + code via POST /api/orders.
      const now = Date.now();
      const newOrder: Order = {
        id: crypto.randomUUID(),
        tenantId,
        code: 'PENDING',
        customerId: input.customerId ?? '',
        customerName: input.customerName ?? 'Cliente',
        status: 'received',
        total: 0,
        paid: 0,
        balance: 0,
        items: [],
        notes: input.notes,
        estimatedDeliveryAt: input.estimatedDeliveryAt,
        createdAt: now,
        updatedAt: now,
      };

      await orderRepo.put(newOrder);
      await enqueueSync({
        entity: 'order',
        entityId: newOrder.id,
        op: 'create',
        payload: newOrder,
        timestamp: now,
      });
      return newOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      void useSyncStore.getState().recomputePending();
    },
  });
}