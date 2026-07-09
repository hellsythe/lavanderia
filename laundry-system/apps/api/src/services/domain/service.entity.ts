/**
 * Service — TS puro entity.
 * Soft delete: `deletedAt` se setea en lugar de borrar.
 */
export interface Service {
  id: string;
  tenantId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  unit: 'kg' | 'piece';
  unitPrice: number;
  /** Cantidad mínima al cargar este servicio en un pedido. Default 1. */
  minQuantity: number;
  active: boolean;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ServiceCategory {
  id: string;
  tenantId: string;
  name: string;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}