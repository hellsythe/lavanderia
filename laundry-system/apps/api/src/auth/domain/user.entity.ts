/**
 * User entity — TypeScript puro, sin decoradores de ORM.
 * Esta capa es agnóstica a infraestructura. La entidad ORM vivirá
 * en infrastructure/persistence con mapeo explícito.
 */
export type UserRole = 'super_admin' | 'tenant_admin' | 'operator' | 'delivery';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  active: boolean;
  tokenVersion: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Tenant entity — una lavandería cliente SaaS.
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'trial' | 'starter' | 'pro' | 'enterprise';
  createdAt: number;
  updatedAt: number;
}