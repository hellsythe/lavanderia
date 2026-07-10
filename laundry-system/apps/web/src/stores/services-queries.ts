'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { serviceRepo, type ServiceSnapshot } from '@lavanderpro/db-client';
import {
  enqueueSync,
  useNetworkStore,
} from '@lavanderpro/sync-engine';
import type {
  CreateServiceInput,
  Service,
  UpdateServiceInput,
} from '@lavanderpro/shared-types';
import { servicesApi, type ListServicesParams } from '~/lib/api-client';

/**
 * Hooks de Service con offline-first semantics (mismo patrón que categories).
 *
 * Reads:
 *   1. Si online → fetch del API + bulkPut en cache local
 *   2. Si offline o falla → devuelve cache local (filtrado por tenantId)
 *
 * Writes:
 *   1. Apply local optimista (UI actualiza inmediato)
 *   2. Enqueue a sync_queue
 *   3. Si online, intentar API directo también (best-effort)
 *
 * `tenantId` se pasa al hook para filtrar el cache local.
 * NO se envía al server — el server lo extrae del JWT.
 */

export const serviceKeys = {
  all: ['services'] as const,
  list: (params: ListServicesParams & { tenantId?: string }) =>
    [...serviceKeys.all, 'list', params] as const,
  detail: (id: string) => [...serviceKeys.all, 'detail', id] as const,
};

interface UseServicesParams extends ListServicesParams {
  tenantId?: string;
}

export function useServices(params: UseServicesParams = {}) {
  const { tenantId, ...apiParams } = params;
  return useQuery<ServiceSnapshot[]>({
    queryKey: serviceKeys.list(params),
    queryFn: async (): Promise<ServiceSnapshot[]> => {
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          const response = await servicesApi.list(apiParams);
          // MERGE con cache local — preserva rows offline-pending.
          if (!tenantId) return response.items;
          return await serviceRepo.mergeFromServer(tenantId, response.items);
        } catch (e) {
          console.warn('[useServices] fetch failed, using cache:', e);
          if (!tenantId) return [];
          return serviceRepo.list(tenantId, {
            categoryId: apiParams.categoryId,
            onlyActive: apiParams.onlyActive,
          });
        }
      }
      // Offline: leer cache
      if (!tenantId) return [];
      return serviceRepo.list(tenantId, {
        categoryId: apiParams.categoryId,
        onlyActive: apiParams.onlyActive,
      });
    },
    staleTime: 30_000,
  });
}

export function useService(id: string | undefined) {
  return useQuery<ServiceSnapshot | null>({
    queryKey: serviceKeys.detail(id ?? ''),
    queryFn: async (): Promise<ServiceSnapshot | null> => {
      if (!id) return null;
      return serviceRepo.findById(id);
    },
    enabled: !!id,
  });
}

export function useCreateService(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateServiceInput): Promise<ServiceSnapshot> => {
      // 1. Crear local con UUID v7
      const local = await serviceRepo.createLocal({
        tenantId,
        name: input.name,
        description: input.description,
        categoryId: input.categoryId ?? null,
        unit: input.unit,
        unitPrice: input.unitPrice,
        minQuantity: input.minQuantity,
        active: input.active,
      });

      // 2. Enqueue sync
      await enqueueSync({
        entity: 'service',
        entityId: local.id,
        op: 'create',
        payload: local,
        timestamp: Date.now(),
      });

      // 3. Best-effort API
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          await servicesApi.create(input);
        } catch (e) {
          console.warn('[useCreateService] api call failed, will sync later:', e);
        }
      }

      return local;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.all });
    },
  });
}

export function useUpdateService(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateServiceInput;
    }): Promise<ServiceSnapshot> => {
      // 1. Update local
      const updated = await serviceRepo.updateLocal(id, {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        unit: input.unit,
        unitPrice: input.unitPrice,
        minQuantity: input.minQuantity,
        active: input.active,
      });

      // 2. Enqueue sync
      await enqueueSync({
        entity: 'service',
        entityId: id,
        op: 'update',
        payload: updated,
        timestamp: Date.now(),
      });

      // 3. Best-effort API
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          await servicesApi.update(id, input);
        } catch (e) {
          console.warn('[useUpdateService] api call failed, will sync later:', e);
        }
      }

      void tenantId;
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.all });
    },
  });
}

export function useDeleteService(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<ServiceSnapshot> => {
      // 1. Soft delete local (preserva tombstone para sync)
      const deleted = await serviceRepo.softDeleteLocal(id);

      // 2. Enqueue sync
      await enqueueSync({
        entity: 'service',
        entityId: id,
        op: 'delete',
        payload: deleted,
        timestamp: Date.now(),
      });

      // 3. Best-effort API
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          await servicesApi.remove(id);
        } catch (e) {
          console.warn('[useDeleteService] api call failed, will sync later:', e);
        }
      }

      void tenantId;
      return deleted;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceKeys.all });
    },
  });
}

// Re-export para uso en consumers sin importar desde db-client
export type { Service } from '@lavanderpro/shared-types';