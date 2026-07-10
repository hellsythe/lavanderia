import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CustomerOrmEntity } from '../../database/entities/customer.orm-entity';
import { Customer } from '../domain/customer.entity';
import {
  CUSTOMER_REPOSITORY,
  type CustomerListFilters,
  type CustomerRepositoryPort,
  type ListCustomersResult,
} from '../ports/customer-repository.port';

@Injectable()
export class TypeormCustomerRepository implements CustomerRepositoryPort {
  constructor(
    @InjectRepository(CustomerOrmEntity)
    private readonly repo: Repository<CustomerOrmEntity>,
  ) {}

  async findById(id: string, tenantId: string): Promise<Customer | null> {
    const result = await this.repo.manager.query(
      `SELECT id, tenant_id, name, phone, email, address, notes, rfc, legal_name, deleted_at, created_at, updated_at
       FROM customers
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    const rows = result as Record<string, unknown>[] | undefined;
    const first = rows?.[0];
    return first ? this.mapRowToDomain(first) : null;
  }

  async findByName(name: string, tenantId: string): Promise<Customer | null> {
    const result = await this.repo.manager.query(
      `SELECT id, tenant_id, name, phone, email, address, notes, rfc, legal_name, deleted_at, created_at, updated_at
       FROM customers
       WHERE name = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [name, tenantId],
    );
    const rows = result as Record<string, unknown>[] | undefined;
    const first = rows?.[0];
    return first ? this.mapRowToDomain(first) : null;
  }

  async list(tenantId: string, filters: CustomerListFilters): Promise<ListCustomersResult> {
    const hasSearch = !!(filters.search && filters.search.trim().length > 0);
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    let whereClause = `WHERE tenant_id = $1 AND deleted_at IS NULL`;
    const itemsParams: unknown[] = [tenantId];
    const countParams: unknown[] = [tenantId];

    if (hasSearch) {
      const like = `%${filters.search!.toLowerCase()}%`;
      whereClause += ` AND (LOWER(name) LIKE $2 OR LOWER(COALESCE(phone, '')) LIKE $2 OR LOWER(COALESCE(email, '')) LIKE $2 OR LOWER(COALESCE(rfc, '')) LIKE $2 OR LOWER(COALESCE(legal_name, '')) LIKE $2)`;
      itemsParams.push(like);
      countParams.push(like);
    }

    const itemsQuery = `
      SELECT id, tenant_id, name, phone, email, address, notes, rfc, legal_name, deleted_at, created_at, updated_at
      FROM customers
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${itemsParams.length + 1} OFFSET $${itemsParams.length + 2}
    `;
    itemsParams.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*)::int AS count
      FROM customers
      ${whereClause}
    `;

    const em = this.repo.manager;
    const [rawItems, rawCount] = await Promise.all([
      em.query(itemsQuery, itemsParams),
      em.query(countQuery, countParams),
    ]);

    const items = (rawItems as Record<string, unknown>[]).map((row) =>
      this.mapRowToDomain(row),
    );
    const total = (rawCount as { count: number }[])[0]?.count ?? 0;
    return { items, total };
  }

  async create(
    customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> &
      Partial<Pick<Customer, 'id'>>,
  ): Promise<Customer> {
    const result = await this.repo.manager.query(
      // Si el cliente envía id, lo respetamos (offline-first). Si no, el
      // server genera uno (default uuid_generate_v4()).
      `INSERT INTO customers (id, tenant_id, name, phone, email, address, notes, rfc, legal_name)
       VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, tenant_id, name, phone, email, address, notes, rfc, legal_name, deleted_at, created_at, updated_at`,
      [
        customer.id ?? null,
        customer.tenantId,
        customer.name,
        customer.phone ?? null,
        customer.email ?? null,
        customer.address ?? null,
        customer.notes ?? null,
        customer.rfc ?? null,
        customer.legalName ?? null,
      ],
    );
    const rows = result as Record<string, unknown>[] | undefined;
    if (!rows || rows.length === 0) {
      throw new Error('Customer creation failed');
    }
    const first = rows[0];
    if (!first) throw new Error('Customer creation returned no row');
    return this.mapRowToDomain(first);
  }

  async update(customer: Customer): Promise<Customer> {
    const result = await this.repo.manager.query(
      `UPDATE customers
       SET name = $3, phone = $4, email = $5, address = $6, notes = $7, rfc = $8, legal_name = $9
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       RETURNING id, tenant_id, name, phone, email, address, notes, rfc, legal_name, deleted_at, created_at, updated_at`,
      [
        customer.id,
        customer.tenantId,
        customer.name,
        customer.phone ?? null,
        customer.email ?? null,
        customer.address ?? null,
        customer.notes ?? null,
        customer.rfc ?? null,
        customer.legalName ?? null,
      ],
    );
    const rows = result as Record<string, unknown>[] | undefined;
    if (!rows || rows.length === 0) {
      throw new Error(`Customer ${customer.id} no encontrado en tenant ${customer.tenantId}`);
    }
    const first = rows[0];
    if (!first) throw new Error('Customer update returned no row');
    return this.mapRowToDomain(first);
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.repo.manager.query(
      `UPDATE customers SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
  }

  private mapRowToDomain(row: Record<string, unknown>): Customer {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      phone: (row.phone as string) || undefined,
      email: (row.email as string) || undefined,
      address: (row.address as string) || undefined,
      notes: (row.notes as string) || undefined,
      rfc: (row.rfc as string) || undefined,
      legalName: (row.legal_name as string) || undefined,
      deletedAt: row.deleted_at ? new Date(row.deleted_at as string).getTime() : null,
      createdAt: new Date(row.created_at as string).getTime(),
      updatedAt: new Date(row.updated_at as string).getTime(),
    };
  }
}

export { CUSTOMER_REPOSITORY };