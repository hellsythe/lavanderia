/**
 * Customer — pure TS entity.
 * Soft delete: `deletedAt` se setea cuando se elimina.
 * Las queries filtran por `deletedAt IS NULL`.
 */
export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  deletedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}