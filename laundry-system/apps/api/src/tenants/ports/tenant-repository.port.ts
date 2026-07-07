import type { Tenant } from '../domain/tenant.entity';

/**
 * Output port — contrato de persistencia de tenants.
 *
 * Único módulo "dueño" de tenants: cuando otro módulo necesita un Tenant,
 * llama a TenantsService, NO a este repositorio directamente.
 */
export interface TenantRepositoryPort {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  create(tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant>;
}

export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY');