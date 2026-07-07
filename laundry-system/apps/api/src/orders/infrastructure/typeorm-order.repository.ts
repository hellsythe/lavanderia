import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderItemOrmEntity } from './order-item.orm-entity';
import { OrderOrmEntity } from './order.orm-entity';
import {
  type Order,
  type OrderItem,
  type OrderStatus,
} from '@lavanderpro/shared-types';
import {
  type ListOrdersFilters,
  type ListOrdersResult,
  type OrderRepositoryPort,
} from '../ports/order-repository.port';

/**
 * TypeORM implementation of OrderRepositoryPort.
 *
 * Multi-tenant: TODAS las queries reciben `tenantId` explícito y lo
 * aplican en WHERE. Nunca confiar en datos del request sin filtrar.
 */
@Injectable()
export class TypeormOrderRepository implements OrderRepositoryPort {
  constructor(
    @InjectRepository(OrderOrmEntity)
    private readonly repo: Repository<OrderOrmEntity>,
    @InjectRepository(OrderItemOrmEntity)
    private readonly itemsRepo: Repository<OrderItemOrmEntity>,
  ) {}

  async create(
    order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'code'>,
  ): Promise<Order> {
    const code = await this.nextOrderCode(order.tenantId);
    const row = this.repo.create({
      tenantId: order.tenantId,
      customerId: order.customerId,
      customerName: order.customerName,
      status: order.status,
      total: order.total.toFixed(2),
      paid: order.paid.toFixed(2),
      balance: order.balance.toFixed(2),
      estimatedDeliveryAt: order.estimatedDeliveryAt
        ? new Date(order.estimatedDeliveryAt)
        : undefined,
      notes: order.notes,
      items: order.items.map((i) => ({
        serviceId: i.serviceId,
        serviceName: i.serviceName,
        unit: i.unit,
        quantity: i.quantity.toFixed(3),
        unitPrice: i.unitPrice.toFixed(2),
        subtotal: i.subtotal.toFixed(2),
        notes: i.notes,
      })),
    });
    const saved = await this.repo.save(row);
    return this.toDomain(saved);
  }

  async findById(id: string, tenantId: string): Promise<Order | null> {
    const row = await this.repo.findOne({
      where: { id, tenantId },
      relations: { items: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByCode(code: string, tenantId: string): Promise<Order | null> {
    const row = await this.repo.findOne({
      where: { code, tenantId },
      relations: { items: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(tenantId: string, filters: ListOrdersFilters): Promise<ListOrdersResult> {
    const qb = this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o.tenant_id = :tenantId', { tenantId });

    if (filters.status?.length) {
      qb.andWhere('o.status IN (:...statuses)', { statuses: filters.status });
    }
    if (filters.customerId) {
      qb.andWhere('o.customer_id = :cid', { cid: filters.customerId });
    }
    if (filters.updatedSince !== undefined) {
      qb.andWhere('o.updated_at > :since', {
        since: new Date(filters.updatedSince),
      });
    }

    qb.orderBy('o.created_at', 'DESC')
      .addOrderBy('items.id', 'ASC')
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0);

    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((r) => this.toDomain(r)),
      total,
    };
  }

  async save(order: Order): Promise<Order> {
    const existing = await this.repo.findOne({
      where: { id: order.id, tenantId: order.tenantId },
      relations: { items: true },
    });
    if (!existing) {
      throw new Error(`Order ${order.id} no encontrada en tenant ${order.tenantId}`);
    }

    existing.status = order.status;
    existing.total = order.total.toFixed(2);
    existing.paid = order.paid.toFixed(2);
    existing.balance = order.balance.toFixed(2);
    existing.estimatedDeliveryAt = order.estimatedDeliveryAt
      ? new Date(order.estimatedDeliveryAt)
      : undefined;
    existing.deliveredAt = order.deliveredAt
      ? new Date(order.deliveredAt)
      : undefined;
    existing.notes = order.notes;
    existing.customerName = order.customerName;

    // Simplificación: borrar items existentes y re-insertar.
    // Suficiente para MVP; cuando crezca, hacer diff.
    await this.itemsRepo.delete({ orderId: order.id });
    existing.items = order.items.map((i) =>
      this.itemsRepo.create({
        orderId: order.id,
        serviceId: i.serviceId,
        serviceName: i.serviceName,
        unit: i.unit,
        quantity: i.quantity.toFixed(3),
        unitPrice: i.unitPrice.toFixed(2),
        subtotal: i.subtotal.toFixed(2),
        notes: i.notes,
      }),
    );

    const saved = await this.repo.save(existing);
    return this.toDomain(saved);
  }

  async nextOrderCode(tenantId: string): Promise<string> {
    // MVP: count + 1. Para producción usar tabla counters con row-level lock.
    const count = await this.repo.count({ where: { tenantId } });
    const next = count + 1;
    return `ORD-${String(next).padStart(4, '0')}`;
  }

  async countByStatus(tenantId: string): Promise<Record<OrderStatus, number>> {
    const rows = await this.repo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere(
        "o.created_at > NOW() - INTERVAL '30 days'",
      )
      .groupBy('o.status')
      .getRawMany<{ status: OrderStatus; count: string }>();

    const result: Record<OrderStatus, number> = {
      received: 0,
      in_process: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const r of rows) {
      result[r.status] = Number(r.count);
    }
    return result;
  }

  private toDomain(row: OrderOrmEntity): Order {
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      customerId: row.customerId,
      customerName: row.customerName,
      status: row.status,
      total: Number(row.total),
      paid: Number(row.paid),
      balance: Number(row.balance),
      estimatedDeliveryAt: row.estimatedDeliveryAt?.getTime(),
      deliveredAt: row.deliveredAt?.getTime(),
      notes: row.notes ?? undefined,
      items: (row.items ?? []).map(this.itemToDomain),
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }

  private itemToDomain = (i: OrderItemOrmEntity): OrderItem => ({
    id: i.id,
    orderId: i.orderId,
    serviceId: i.serviceId,
    serviceName: i.serviceName,
    unit: i.unit,
    quantity: Number(i.quantity),
    unitPrice: Number(i.unitPrice),
    subtotal: Number(i.subtotal),
    notes: i.notes ?? undefined,
  });
}