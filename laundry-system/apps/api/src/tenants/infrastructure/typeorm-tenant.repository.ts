import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Tenant } from '../domain/tenant.entity';
import {
  TENANT_REPOSITORY,
  type CreateTenantInput,
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

  async create(tenant: CreateTenantInput): Promise<Tenant> {
    const row = this.repo.create({
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
    });
    const saved = await this.repo.save(row);
    return this.toDomain(saved);
  }

  async update(id: string, patch: Partial<Tenant>): Promise<Tenant> {
    // Solo enviamos al UPDATE las columnas provistas en `patch`.
    // `undefined` significa "no tocar"; `null` significa "limpiar".
    const fields: Partial<TenantOrmEntity> = {};
    if (patch.fiscalName !== undefined) fields.fiscalName = patch.fiscalName ?? null;
    if (patch.fiscalAddress !== undefined) fields.fiscalAddress = patch.fiscalAddress ?? null;
    if (patch.fiscalTaxId !== undefined) fields.fiscalTaxId = patch.fiscalTaxId ?? null;
    if (patch.branchName !== undefined) fields.branchName = patch.branchName ?? null;
    if (patch.branchAddress !== undefined) fields.branchAddress = patch.branchAddress ?? null;
    if (patch.branchPhone !== undefined) fields.branchPhone = patch.branchPhone ?? null;
    if (patch.whatsappPhone !== undefined) fields.whatsappPhone = patch.whatsappPhone ?? null;
    if (patch.whatsappVerifiedAt !== undefined) {
      fields.whatsappVerifiedAt = patch.whatsappVerifiedAt ? new Date(patch.whatsappVerifiedAt) : null;
    }
    if (patch.onboardingStep !== undefined) fields.onboardingStep = patch.onboardingStep;
    if (patch.onboardingCompletedAt !== undefined) {
      fields.onboardingCompletedAt = patch.onboardingCompletedAt
        ? new Date(patch.onboardingCompletedAt)
        : null;
    }
    if (patch.logoUrl !== undefined) fields.logoUrl = patch.logoUrl ?? null;

    await this.repo.update({ id }, fields);
    const updated = await this.repo.findOne({ where: { id } });
    if (!updated) {
      throw new Error(`Tenant ${id} no encontrado tras update`);
    }
    return this.toDomain(updated);
  }

  private toDomain(row: TenantOrmEntity): Tenant {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      fiscalName: row.fiscalName ?? undefined,
      fiscalAddress: row.fiscalAddress ?? undefined,
      fiscalTaxId: row.fiscalTaxId ?? undefined,
      branchName: row.branchName ?? undefined,
      branchAddress: row.branchAddress ?? undefined,
      branchPhone: row.branchPhone ?? undefined,
      whatsappPhone: row.whatsappPhone ?? undefined,
      whatsappVerifiedAt: row.whatsappVerifiedAt ? row.whatsappVerifiedAt.getTime() : undefined,
      onboardingStep: row.onboardingStep,
      onboardingCompletedAt: row.onboardingCompletedAt
        ? row.onboardingCompletedAt.getTime()
        : undefined,
      logoUrl: row.logoUrl ?? undefined,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }
}

export { TENANT_REPOSITORY };