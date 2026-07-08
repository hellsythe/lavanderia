import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ServiceOrmEntity } from '../infrastructure/entities/service.orm-entity';
import { Service, ServiceCategory } from '../domain/service.entity';
import {
  SERVICE_REPOSITORY,
  type ListServicesResult,
  type ServiceListFilters,
  type ServiceRepositoryPort,
} from '../ports/service-repository.port';

const SERVICE_COLS =
  'id, tenant_id, category_id, name, description, unit, unit_price, active, deleted_at, created_at, updated_at';

function toDomain(row: Record<string, unknown>): Service {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    categoryId: (row.category_id as string) || null,
    name: row.name as string,
    description: (row.description as string) || null,
    unit: row.unit as 'kg' | 'piece',
    unitPrice: Number(row.unit_price),
    active: row.active as boolean,
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string).getTime() : null,
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  };
}

@Injectable()
export class TypeormServiceRepository implements ServiceRepositoryPort {
  constructor(
    @InjectRepository(ServiceOrmEntity)
    private readonly repo: Repository<ServiceOrmEntity>,
  ) {}

  async findById(id: string, tenantId: string): Promise<Service | null> {
    const result = await this.repo.manager.query(
      `SELECT ${SERVICE_COLS} FROM services WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    const rows = result as Record<string, unknown>[] | undefined;
    const first = rows?.[0];
    return first ? toDomain(first) : null;
  }

  async findByName(name: string, tenantId: string): Promise<Service | null> {
    const result = await this.repo.manager.query(
      `SELECT ${SERVICE_COLS} FROM services WHERE name = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [name, tenantId],
    );
    const rows = result as Record<string, unknown>[] | undefined;
    const first = rows?.[0];
    return first ? toDomain(first) : null;
  }

  async list(tenantId: string, filters: ServiceListFilters): Promise<ListServicesResult> {
    const wheres: string[] = ['tenant_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [tenantId];

    if (filters.categoryId) {
      wheres.push('category_id = $2');
      params.push(filters.categoryId);
    }
    if (filters.onlyActive ?? true) {
      wheres.push('active = true');
    }
    if (filters.search && filters.search.trim().length > 0) {
      wheres.push('LOWER(name) LIKE $' + (params.length + 1));
      params.push(`%${filters.search.toLowerCase()}%`);
    }

    const whereClause = wheres.join(' AND ');
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const itemsQuery = `
      SELECT ${SERVICE_COLS} FROM services
      WHERE ${whereClause}
      ORDER BY name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countQuery = `SELECT COUNT(*)::int AS count FROM services WHERE ${whereClause}`;

    const em = this.repo.manager;
    const [rawItems, rawCount] = await Promise.all([
      em.query(itemsQuery, [...params, limit, offset]),
      em.query(countQuery, params),
    ]);

    const items = (rawItems as Record<string, unknown>[]).map(toDomain);
    const total = (rawCount as { count: number }[])[0]?.count ?? 0;
    return { items, total };
  }

  async create(
    service: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Service> {
    const result = await this.repo.manager.query(
      `INSERT INTO services (tenant_id, category_id, name, description, unit, unit_price, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SERVICE_COLS}`,
      [
        service.tenantId,
        service.categoryId,
        service.name,
        service.description,
        service.unit,
        service.unitPrice.toFixed(2),
        service.active,
      ],
    );
    const rows = result as Record<string, unknown>[];
    if (!rows[0]) throw new Error('Service creation returned no row');
    return toDomain(rows[0]);
  }

  async update(service: Service): Promise<Service> {
    const result = await this.repo.manager.query(
      `UPDATE services
       SET name = $3, category_id = $4, description = $5, unit = $6, unit_price = $7, active = $8
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       RETURNING ${SERVICE_COLS}`,
      [
        service.id,
        service.tenantId,
        service.name,
        service.categoryId,
        service.description,
        service.unit,
        service.unitPrice.toFixed(2),
        service.active,
      ],
    );
    const rows = result as Record<string, unknown>[];
    if (!rows[0]) {
      throw new Error(`Service ${service.id} no encontrado en tenant ${service.tenantId}`);
    }
    return toDomain(rows[0]);
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.repo.manager.query(
      `UPDATE services SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
  }
}

export { SERVICE_REPOSITORY };

// === Categories ===

const CATEGORY_COLS = 'id, tenant_id, name, deleted_at, created_at, updated_at';

function catToDomain(row: Record<string, unknown>): ServiceCategory {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string).getTime() : null,
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  };
}

@Injectable()
export class TypeormServiceCategoryRepository {
  constructor(
    @InjectRepository(ServiceOrmEntity)
    private readonly repo: Repository<ServiceOrmEntity>,
  ) {}

  async findById(id: string, tenantId: string): Promise<ServiceCategory | null> {
    const result = await this.repo.manager.query(
      `SELECT ${CATEGORY_COLS} FROM service_categories WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    const rows = result as Record<string, unknown>[] | undefined;
    const first = rows?.[0];
    return first ? catToDomain(first) : null;
  }

  async findByName(name: string, tenantId: string): Promise<ServiceCategory | null> {
    const result = await this.repo.manager.query(
      `SELECT ${CATEGORY_COLS} FROM service_categories WHERE name = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [name, tenantId],
    );
    const rows = result as Record<string, unknown>[] | undefined;
    const first = rows?.[0];
    return first ? catToDomain(first) : null;
  }

  async list(
    tenantId: string,
    filters: { limit?: number; offset?: number },
  ): Promise<{ items: ServiceCategory[]; total: number }> {
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;
    const result = await this.repo.manager.query(
      `SELECT ${CATEGORY_COLS} FROM service_categories
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY name ASC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );
    const countResult = await this.repo.manager.query(
      `SELECT COUNT(*)::int AS count FROM service_categories WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [tenantId],
    );
    const items = (result as Record<string, unknown>[]).map(catToDomain);
    const total = (countResult as { count: number }[])[0]?.count ?? 0;
    return { items, total };
  }

  async create(
    cat: Omit<ServiceCategory, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<ServiceCategory> {
    const result = await this.repo.manager.query(
      `INSERT INTO service_categories (tenant_id, name)
       VALUES ($1, $2)
       RETURNING ${CATEGORY_COLS}`,
      [cat.tenantId, cat.name],
    );
    const rows = result as Record<string, unknown>[];
    if (!rows[0]) throw new Error('Category creation returned no row');
    return catToDomain(rows[0]);
  }

  async update(cat: ServiceCategory): Promise<ServiceCategory> {
    const result = await this.repo.manager.query(
      `UPDATE service_categories SET name = $3
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       RETURNING ${CATEGORY_COLS}`,
      [cat.id, cat.tenantId, cat.name],
    );
    const rows = result as Record<string, unknown>[];
    if (!rows[0]) {
      throw new Error(`Category ${cat.id} no encontrada en tenant ${cat.tenantId}`);
    }
    return catToDomain(rows[0]);
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.repo.manager.query(
      `UPDATE service_categories SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
  }
}