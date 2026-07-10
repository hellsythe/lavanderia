'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoryRepo, type CategorySnapshot } from '@lavanderpro/db-client';
import {
  enqueueSync,
  useNetworkStore,
} from '@lavanderpro/sync-engine';
import type {
  CreateServiceCategoryInput,
  ServiceCategory,
  UpdateServiceCategoryInput,
} from '@lavanderpro/shared-types';
import { categoriesApi } from '~/lib/api-client';

/**
 * Hooks de ServiceCategory con offline-first semantics.
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
 */

export const categoryKeys = {
  all: ['categories'] as const,
  list: (tenantId?: string) => [...categoryKeys.all, 'list', tenantId ?? ''] as const,
};

interface UseCategoriesParams {
  tenantId?: string;
}

export function useCategories(params: UseCategoriesParams = {}) {
  const { tenantId } = params;
  return useQuery<CategorySnapshot[]>({
    queryKey: categoryKeys.list(tenantId),
    queryFn: async (): Promise<CategorySnapshot[]> => {
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          const response = await categoriesApi.list();
          // MERGE con cache local en vez de REPLACE — preserva rows
          // offline-pending (creadas/editadas sin internet, aún no subidas).
          // Aplica LWW por updatedAt: edición offline con local.updatedAt
          // > server.updatedAt NO se sobreescribe.
          if (!tenantId) return response.items;
          return await categoryRepo.mergeFromServer(tenantId, response.items);
        } catch (e) {
          console.warn('[useCategories] fetch failed, using cache:', e);
          if (!tenantId) return [];
          return categoryRepo.list(tenantId);
        }
      }
      // Offline: leer cache
      if (!tenantId) return [];
      return categoryRepo.list(tenantId);
    },
    staleTime: 30_000,
  });
}

export function useCreateCategory(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateServiceCategoryInput): Promise<CategorySnapshot> => {
      // 1. Crear local con UUID v7 (id estable offline-first).
      const local = await categoryRepo.createLocal({ tenantId, name: input.name });

      // 2. Enqueue sync (con el id del cliente — el server lo va a respetar).
      await enqueueSync({
        entity: 'service_category',
        entityId: local.id,
        op: 'create',
        payload: local,
        timestamp: Date.now(),
      });

      // 3. Best-effort: POST al server con el MISMO id (no se genera otro).
      // Si el server confirma, mergeFromServer hace upsert por id → la
      // local y la del server son la misma row. Sin duplicación.
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          const serverRow = await categoriesApi.create({
            id: local.id,
            name: input.name,
          });
          // Upsert la respuesta del server (mismo id, posible updatedAt más nuevo).
          await categoryRepo.mergeFromServer(tenantId, [serverRow]);
        } catch (e) {
          console.warn('[useCreateCategory] api call failed, will sync later:', e);
        }
      }

      return local;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useUpdateCategory(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateServiceCategoryInput;
    }): Promise<CategorySnapshot> => {
      // 1. Update local
      const updated = await categoryRepo.updateLocal(id, { name: input.name });

      // 2. Enqueue sync
      await enqueueSync({
        entity: 'service_category',
        entityId: id,
        op: 'update',
        payload: updated,
        timestamp: Date.now(),
      });

      // 3. Best-effort API
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          await categoriesApi.update(id, input);
        } catch (e) {
          console.warn('[useUpdateCategory] api call failed, will sync later:', e);
        }
      }

      void tenantId;
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useDeleteCategory(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<CategorySnapshot> => {
      // 1. Soft delete local (preserva tombstone)
      const deleted = await categoryRepo.softDeleteLocal(id);

      // 2. Enqueue sync
      await enqueueSync({
        entity: 'service_category',
        entityId: id,
        op: 'delete',
        payload: deleted,
        timestamp: Date.now(),
      });

      // 3. Best-effort API
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          await categoriesApi.remove(id);
        } catch (e) {
          console.warn('[useDeleteCategory] api call failed, will sync later:', e);
        }
      }

      void tenantId;
      return deleted;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}