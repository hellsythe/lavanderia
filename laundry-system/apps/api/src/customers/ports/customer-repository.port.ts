import type { Customer } from '../domain/customer.entity';

export interface CustomerListFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListCustomersResult {
  items: Customer[];
  total: number;
}

/**
 * Output port — contrato de persistencia de customers.
 * Implementación: TypeormCustomerRepository.
 */
export interface CustomerRepositoryPort {
  findById(id: string, tenantId: string): Promise<Customer | null>;
  findByName(name: string, tenantId: string): Promise<Customer | null>;
  list(tenantId: string, filters: CustomerListFilters): Promise<ListCustomersResult>;
  create(
    customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Customer>;
  update(customer: Customer): Promise<Customer>;
  softDelete(id: string, tenantId: string): Promise<void>;
}

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');