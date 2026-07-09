import type { Tenant } from '../domain/tenant.entity';

/** Campos que el caller provee al crear un tenant. */
export type CreateTenantInput = Omit<
  Tenant,
  'id' | 'createdAt' | 'updatedAt' | 'onboardingStep'
>;

/**
 * Output port — contrato de persistencia de tenants.
 *
 * Único módulo "dueño" de tenants: cuando otro módulo necesita un Tenant,
 * llama a TenantsService, NO a este repositorio directamente.
 */
export interface TenantRepositoryPort {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  create(tenant: CreateTenantInput): Promise<Tenant>;
  update(id: string, patch: Partial<Tenant>): Promise<Tenant>;
}

export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY');