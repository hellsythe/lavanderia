'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchRepo, type BranchSnapshot } from '@lavanderpro/db-client';
import { enqueueSync, useNetworkStore } from '@lavanderpro/sync-engine';
import type { CreateBranchInput, UpdateBranchInput, Branch } from '@lavanderpro/shared-types';
import { branchesApi } from '~/lib/api-client';

export const branchKeys = {
  all: ['branches'] as const,
  list: (tenantId: string) => [...branchKeys.all, 'list', tenantId] as const,
  detail: (id: string) => [...branchKeys.all, 'detail', id] as const,
};

export function useBranches(tenantId?: string) {
  return useQuery<BranchSnapshot[]>({
    queryKey: branchKeys.list(tenantId ?? ''),
    queryFn: async () => {
      if (!tenantId) return [];
      if (useNetworkStore.getState().state !== 'offline') {
        try {
          const server = await branchesApi.list();
          await branchRepo.bulkPut(server as unknown as BranchSnapshot[]);
          return server as unknown as BranchSnapshot[];
        } catch {
          return branchRepo.listByTenant(tenantId);
        }
      }
      return branchRepo.listByTenant(tenantId);
    },
    staleTime: 30_000,
    enabled: !!tenantId,
  });
}

export function useCreateBranch(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBranchInput): Promise<BranchSnapshot> => {
      const now = Date.now();
      const id = crypto.randomUUID();
      const snapshot: BranchSnapshot = {
        id,
        tenantId,
        name: input.name,
        address: input.address,
        phone: input.phone,
        isMain: input.isMain ?? false,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await branchRepo.put(snapshot);
      await enqueueSync({ entity: 'branch', entityId: id, op: 'create', payload: snapshot, timestamp: now });
      if (useNetworkStore.getState().state !== 'offline') {
        try { await branchesApi.create(input); } catch {}
      }
      return snapshot;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: branchKeys.all }); },
  });
}

export function useUpdateBranch(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateBranchInput }): Promise<void> => {
      const existing = await branchRepo.findById(id, tenantId);
      if (!existing) throw new Error('Sucursal no encontrada');
      const updated = { ...existing, ...input, updatedAt: Date.now() } as Branch;
      await branchRepo.put(updated as unknown as BranchSnapshot);
      await enqueueSync({ entity: 'branch', entityId: id, op: 'update', payload: updated, timestamp: Date.now() });
      if (useNetworkStore.getState().state !== 'offline') {
        try { await branchesApi.update(id, input); } catch {}
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: branchKeys.all }); },
  });
}

export function useDeleteBranch(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const existing = await branchRepo.findById(id, tenantId);
      if (!existing) return;
      await branchRepo.put({ ...existing, active: false, updatedAt: Date.now() });
      await enqueueSync({ entity: 'branch', entityId: id, op: 'delete', payload: { id, tenantId, active: false, updatedAt: Date.now() }, timestamp: Date.now() });
      if (useNetworkStore.getState().state !== 'offline') {
        try { await branchesApi.remove(id); } catch {}
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: branchKeys.all }); },
  });
}
