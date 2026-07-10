import type { Service, ServiceCategory } from '../domain/service.entity';

export interface ServiceListFilters {
  categoryId?: string;
  onlyActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListServicesResult {
  items: Service[];
  total: number;
}

export interface ServiceCategoryListFilters {
  limit?: number;
  offset?: number;
}

/**
 * Output port — contrato de persistencia de services y categorías.
 */
export interface ServiceRepositoryPort {
  findById(id: string, tenantId: string): Promise<Service | null>;
  findByName(name: string, tenantId: string): Promise<Service | null>;
  list(tenantId: string, filters: ServiceListFilters): Promise<ListServicesResult>;
  create(
    service: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> &
      Partial<Pick<Service, 'id'>>,
  ): Promise<Service>;
  update(service: Service): Promise<Service>;
  softDelete(id: string, tenantId: string): Promise<void>;
}

export const SERVICE_REPOSITORY = Symbol('SERVICE_REPOSITORY');

export interface ServiceCategoryRepositoryPort {
  findById(id: string, tenantId: string): Promise<ServiceCategory | null>;
  findByName(name: string, tenantId: string): Promise<ServiceCategory | null>;
  list(tenantId: string, filters: ServiceCategoryListFilters): Promise<{ items: ServiceCategory[]; total: number }>;
  create(
    cat: Omit<ServiceCategory, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> &
      Partial<Pick<ServiceCategory, 'id'>>,
  ): Promise<ServiceCategory>;
  update(cat: ServiceCategory): Promise<ServiceCategory>;
  softDelete(id: string, tenantId: string): Promise<void>;
}

export const SERVICE_CATEGORY_REPOSITORY = Symbol('SERVICE_CATEGORY_REPOSITORY');