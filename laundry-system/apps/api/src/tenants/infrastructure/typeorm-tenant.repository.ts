import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Tenant } from '../domain/tenant.entity';
import {
  TENANT_REPOSITORY,
  type TenantRepositoryPort,
} from '../ports/tenant-repository.port';
import { TenantOrmEntity } from './tenant.orm-entity';

/**
 * TypeORM implementation of TenantRepositoryPort.
 */
@Injectable()
export class TypeormTenantRepository implements TenantRepositoryPort {
  constructor(
    @InjectRepository(TenantOrmEntity)
    private readonly repo: Repository<TenantOrmEntity>,
  ) {}

  async findById(id: string): Promise<Tenant | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const row = await this.repo.findOne({ where: { slug } });
    return row ? this.toDomain(row) : null;
  }

  async create(tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    const row = this.repo.create({
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
    });
    const saved = await this.repo.save(row);
    return this.toDomain(saved);
  }

  private toDomain(row: TenantOrmEntity): Tenant {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }
}

export { TENANT_REPOSITORY };