import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BranchOrmEntity } from './branch.orm-entity';
import type { Branch, CreateBranchInput } from '../domain/branch.entity';
import type { BranchRepositoryPort } from '../ports/branch-repository.port';

@Injectable()
export class TypeormBranchRepository implements BranchRepositoryPort {
  private readonly logger = new Logger(TypeormBranchRepository.name);

  constructor(
    @InjectRepository(BranchOrmEntity)
    private readonly repo: Repository<BranchOrmEntity>,
  ) {}

  async findById(id: string, tenantId: string): Promise<Branch | null> {
    const row = await this.repo.findOne({ where: { id, tenantId, active: true } });
    return row ? this.toDomain(row) : null;
  }

  async findByMain(tenantId: string): Promise<Branch | null> {
    const row = await this.repo.findOne({
      where: { tenantId, isMain: true, active: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async listByTenant(tenantId: string): Promise<Branch[]> {
    const rows = await this.repo.find({
      where: { tenantId, active: true },
      order: { isMain: 'DESC', createdAt: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async create(input: CreateBranchInput, tenantId: string): Promise<Branch> {
    if (input.isMain) {
      await this.unsetMainByTenant(tenantId);
    }
    const row = this.repo.create({
      tenantId,
      name: input.name,
      address: input.address,
      phone: input.phone,
      isMain: input.isMain ?? false,
      active: true,
    });
    const saved = await this.repo.save(row);
    return this.toDomain(saved);
  }

  async update(
    id: string,
    tenantId: string,
    patch: Partial<Branch>,
  ): Promise<Branch> {
    if (patch.isMain) {
      await this.unsetMainByTenant(tenantId);
    }
    await this.repo.update({ id, tenantId }, patch);
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new Error(`Branch ${id} not found`);
    return this.toDomain(row);
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    const branch = await this.repo.findOne({ where: { id, tenantId } });
    if (!branch) return;
    if (branch.isMain) {
      this.logger.warn(`Cannot delete main branch ${id}`);
      return;
    }
    await this.repo.update({ id, tenantId }, { active: false });
  }

  private async unsetMainByTenant(tenantId: string): Promise<void> {
    await this.repo.update(
      { tenantId, isMain: true },
      { isMain: false },
    );
  }

  private toDomain(row: BranchOrmEntity): Branch {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      address: row.address ?? undefined,
      phone: row.phone ?? undefined,
      isMain: row.isMain,
      active: row.active,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }
}
