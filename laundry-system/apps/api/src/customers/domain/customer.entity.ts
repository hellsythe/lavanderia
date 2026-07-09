/**
 * Customer — pure TS entity.
 * Soft delete: `deletedAt` se setea cuando se elimina.
 * Las queries filtran por `deletedAt IS NULL`.
 *
 * Datos fiscales opcionales (RFC + razón social) para facturación.
 */
export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  /** RFC (Registro Federal de Contribuyentes, México). Opcional. */
  rfc?: string;
  /** Razón social — opcional, útil para facturación. */
  legalName?: string;
  deletedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}