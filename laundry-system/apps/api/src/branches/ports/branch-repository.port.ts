import type { Branch, CreateBranchInput } from '../domain/branch.entity';

export interface BranchRepositoryPort {
  findById(id: string, tenantId: string): Promise<Branch | null>;
  findByMain(tenantId: string): Promise<Branch | null>;
  listByTenant(tenantId: string): Promise<Branch[]>;
  create(input: CreateBranchInput, tenantId: string): Promise<Branch>;
  update(id: string, tenantId: string, patch: Partial<Branch>): Promise<Branch>;
  softDelete(id: string, tenantId: string): Promise<void>;
}

export const BRANCH_REPOSITORY = Symbol('BRANCH_REPOSITORY');
