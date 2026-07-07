import type { User } from '../domain/user.entity';

/**
 * Output port — Users únicamente.
 *
 * Las operaciones de Tenant viven en `tenants/` (módulo separado).
 * Auth NO debe manipular tenants directamente — debe llamar a TenantsService.
 */
export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'tokenVersion'>): Promise<User>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');