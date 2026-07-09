'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerRepo, type CustomerSnapshot } from '@lavanderpro/db-client';
import {
  enqueueSync,
  useNetworkStore,
} from '@lavanderpro/sync-engine';
import type {
  CreateCustomerInput,
  Customer,
  UpdateCustomerInput,
} from '@lavanderpro/shared-types';
import { customersApi, type ListCustomersParams } from '~/lib/api-client';

/**
 * Hooks de Customer con offline-first semantics (mismo patrón que
 * categories y services).
 *
 * Reads: cache-first (Dexie), refresh en background si online.
 * Writes: apply local + enqueue sync + best-effort API.
 */

export const customerKeys = {
  all: ['customers'] as const,
  list: (params: ListCustomersParams & { tenantId?: string }) =>
    [...customerKeys.all, 'list', params] as const,
  detail: (id: string) => [...customerKeys.all, 'detail', id] as const,
};

interface UseCustomersParams extends ListCustomersParams {
  tenantId?: string;
}

export function useCustomers(params: UseCustomersParams = {}) {
  const { tenantId, ...apiParams } = params;
  return useQuery<CustomerSnapshot[]>({
    queryKey: customerKeys.list(params),
    queryFn: async (): Promise<CustomerSnapshot[]> => {
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          const response = await customersApi.list(apiParams);
          // Mapear domain → snapshot (Customer→CustomerSnapshot).
          await customerRepo.bulkPut(response.items);
          return response.items;
        } catch (e) {
          console.warn('[useCustomers] fetch failed, using cache:', e);
          if (!tenantId) return [];
          return customerRepo.getAllByTenant(tenantId);
        }
      }
      if (!tenantId) return [];
      return customerRepo.getAllByTenant(tenantId);
    },
    staleTime: 30_000,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery<CustomerSnapshot | null>({
    queryKey: customerKeys.detail(id ?? ''),
    queryFn: async (): Promise<CustomerSnapshot | null> => {
      if (!id) return null;
      return customerRepo.getById(id);
    },
    enabled: !!id,
  });
}

export function useCreateCustomer(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCustomerInput): Promise<CustomerSnapshot> => {
      // 1. Crear local con UUID v7
      const local = await customerRepo.createLocal({
        tenantId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: input.address,
        notes: input.notes,
        rfc: input.rfc,
        legalName: input.legalName,
      });

      // 2. Enqueue sync
      await enqueueSync({
        entity: 'customer',
        entityId: local.id,
        op: 'create',
        payload: local,
        timestamp: Date.now(),
      });

      // 3. Best-effort API
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          await customersApi.create(input);
        } catch (e) {
          console.warn('[useCreateCustomer] api call failed, will sync later:', e);
        }
      }

      return local;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

export function useUpdateCustomer(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateCustomerInput;
    }): Promise<CustomerSnapshot> => {
      // 1. Update local. La schema usa `null = clear, undefined = no tocar`,
      // pero el snapshot local solo acepta undefined. Convertimos null → undefined.
      const toOpt = <T,>(v: T | null | undefined): T | undefined =>
        v === null ? undefined : v ?? undefined;
      const updated = await customerRepo.updateLocal(id, {
        name: input.name,
        phone: toOpt(input.phone),
        email: toOpt(input.email),
        address: toOpt(input.address),
        notes: toOpt(input.notes),
        rfc: toOpt(input.rfc),
        legalName: toOpt(input.legalName),
      });

      // 2. Enqueue sync
      await enqueueSync({
        entity: 'customer',
        entityId: id,
        op: 'update',
        payload: updated,
        timestamp: Date.now(),
      });

      // 3. Best-effort API
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          await customersApi.update(id, input);
        } catch (e) {
          console.warn('[useUpdateCustomer] api call failed, will sync later:', e);
        }
      }

      void tenantId;
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

export function useDeleteCustomer(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<CustomerSnapshot> => {
      // 1. Soft delete local (preserva tombstone para sync)
      const deleted = await customerRepo.softDeleteLocal(id);

      // 2. Enqueue sync
      await enqueueSync({
        entity: 'customer',
        entityId: id,
        op: 'delete',
        payload: deleted,
        timestamp: Date.now(),
      });

      // 3. Best-effort API
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          await customersApi.remove(id);
        } catch (e) {
          console.warn('[useDeleteCustomer] api call failed, will sync later:', e);
        }
      }

      void tenantId;
      return deleted;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

export type { Customer } from '@lavanderpro/shared-types';