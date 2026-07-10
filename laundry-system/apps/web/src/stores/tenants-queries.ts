'use client';

import { useMutation } from '@tanstack/react-query';
import { pendingUploadRepo } from '@lavanderpro/db-client';
import {
  enqueueSync,
  useNetworkStore,
  useSyncStore,
} from '@lavanderpro/sync-engine';
import type { UpdateTenantInput } from '@lavanderpro/shared-types';
import { ALLOWED_LOGO_MIME_TYPES } from '@lavanderpro/shared-types';
import { tenantsApi } from '~/lib/api-client';
import { useAuth } from './auth-store';

/**
 * useUpdateTenant — actualiza datos del tenant con offline-first.
 *
 * 1. Aplica optimista al auth-store (UI usa el valor local).
 * 2. Enqueue a sync_queue (el tenant se sincroniza cuando vuelva conexión).
 * 3. Best-effort API directo si online.
 */
export function useUpdateTenant(tenantId: string) {
  const storeUpdate = useAuth((s) => s.updateTenant);

  return useMutation({
    mutationFn: async (input: UpdateTenantInput): Promise<void> => {
      // 1. Apply local optimista al auth-store
      try {
        await storeUpdate(input);
      } catch {
        // Si falla online, seguimos offline
      }

      // 2. Enqueue sync (para push cuando vuelva la conexión)
      const tenant = useAuth.getState().tenant;
      if (tenant) {
        await enqueueSync({
          entity: 'tenant',
          entityId: tenant.id,
          op: 'update',
          payload: { ...tenant, ...input, updatedAt: Date.now() },
          timestamp: Date.now(),
        });
      }
    },
    onSuccess: () => {
      void useSyncStore.getState().recomputePending();
    },
  });
}

/**
 * usePresignAndUploadLogo — flujo online para subir el logo.
 *
 * 1. POST /tenants/:id/logo/presign → { uploadUrl, publicUrl }
 * 2. fetch(uploadUrl, { PUT, body: blob })
 * 3. PUT /tenants/:id → { logoUrl: publicUrl }
 *
 * Si está offline, guarda en pendingUploads (Dexie) y el sync engine
 * lo drena cuando vuelva la conexión.
 */
export function usePresignAndUploadLogo(tenantId: string) {
  const storeUpdate = useAuth((s) => s.updateTenant);

  return useMutation({
    mutationFn: async ({
      file,
    }: {
      file: File;
    }): Promise<string> => {
      const isOnline = useNetworkStore.getState().state !== 'offline';

      if (isOnline) {
        // Online: presign → PUT → PATCH
        const presign = await tenantsApi.presignLogoUpload(tenantId, {
          contentType: file.type as typeof ALLOWED_LOGO_MIME_TYPES[number],
          filename: file.name,
        });

        const putRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });

        if (!putRes.ok) {
          throw new Error(`Upload failed: ${putRes.status}`);
        }

        await tenantsApi.update(tenantId, { logoUrl: presign.publicUrl });
        await storeUpdate({ logoUrl: presign.publicUrl } as UpdateTenantInput);

        return presign.publicUrl;
      }

      // Offline: guardar en Dexie para subir al reconectar
      await pendingUploadRepo.push({
        tenantId,
        entity: 'tenant_logo',
        entityId: tenantId,
        blob: file,
        contentType: file.type,
        filename: file.name,
        createdAt: Date.now(),
      });

      // Marcar que hay pending uploads para que el sync engine los vea
      void useSyncStore.getState().recomputePending();

      throw new Error(
        'Logo guardado localmente. Se subirá automáticamente al volver la conexión.',
      );
    },
  });
}
