'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateOrderInput, Order, OrderStatus } from '@lavanderpro/shared-types';
import { ordersApi, type ListOrdersParams, type OrderCounts } from '~/lib/api-client';

/**
 * Hooks de Orders — todas las queries se cachean por tenantId implícito
 * (el JWT lleva tenantId y el backend filtra automáticamente).
 *
 * Las queries se invalidan tras mutations para mantener el dashboard fresco.
 */

export const orderKeys = {
  all: ['orders'] as const,
  list: (params: ListOrdersParams) => [...orderKeys.all, 'list', params] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
  counts: () => [...orderKeys.all, 'counts'] as const,
};

export function useOrders(params: ListOrdersParams = {}) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => ordersApi.list(params),
    staleTime: 30_000, // 30s
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn: () => ordersApi.get(id!),
    enabled: !!id,
  });
}

export function useOrderCounts() {
  return useQuery<OrderCounts>({
    queryKey: orderKeys.counts(),
    queryFn: () => ordersApi.counts(),
    staleTime: 30_000,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => ordersApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}

export function useChangeOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      ordersApi.changeStatus(id, status),
    onSuccess: (order: Order) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.setQueryData(orderKeys.detail(order.id), order);
    },
  });
}