import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import type {
  ServiceCategory,
  SyncChange,
  SyncOperation,
  SyncPullResponse,
} from '@lavanderpro/shared-types';
import { OrderOrmEntity } from '../orders/infrastructure/order.orm-entity';
import { OrderItemOrmEntity } from '../orders/infrastructure/order-item.orm-entity';
import { UserOrmEntity } from '../auth/infrastructure/user.orm-entity';
import { ServiceCategoryOrmEntity } from '../services/infrastructure/entities/service-category.orm-entity';
import { CustomerOrmEntity } from '../database/entities/customer.orm-entity';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepositoryPort,
} from '../customers/ports/customer-repository.port';
import { Order } from '../orders/domain/order.entity';

/**
 * SyncService — endpoints para sincronización offline-first.
 *
 * GET /api/sync/changes?since=... → lista de cambios del tenant
 * POST /api/sync/batch → aplica operaciones del cliente (con LWW)
 *
 * Soporta: orders, service_categories, services, customers.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(OrderOrmEntity)
    private readonly orderRepo: Repository<OrderOrmEntity>,
    @InjectRepository(OrderItemOrmEntity)
    private readonly orderItemRepo: Repository<OrderItemOrmEntity>,
    @InjectRepository(UserOrmEntity)
    private readonly userRepo: Repository<UserOrmEntity>,
    @InjectRepository(ServiceCategoryOrmEntity)
    private readonly categoryRepo: Repository<ServiceCategoryOrmEntity>,
    @InjectRepository(CustomerOrmEntity)
    private readonly customerEntityRepo: Repository<CustomerOrmEntity>,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepo: CustomerRepositoryPort,
  ) {}

  /**
   * Devuelve todos los cambios del tenant con `updatedAt > since`.
   * Incluye orders + service_categories.
   */
  async getChanges(tenantId: string, since: number): Promise<SyncPullResponse> {
    const sinceDate = since > 0 ? new Date(since) : undefined;

    const [orders, categories] = await Promise.all([
      this.orderRepo.find({
        where: sinceDate
          ? { tenantId, updatedAt: MoreThan(sinceDate) }
          : { tenantId },
        relations: { items: true },
        order: { updatedAt: 'ASC' },
        take: 500,
      }),
      this.categoryRepo.find({
        where: sinceDate
          ? { tenantId, updatedAt: MoreThan(sinceDate) }
          : { tenantId },
        order: { updatedAt: 'ASC' },
        take: 500,
      }),
    ]);

    const changes: SyncChange[] = [
      ...orders.map((o) => ({
        entity: 'order' as const,
        entityId: o.id,
        op: 'update' as const,
        payload: this.orderToDomain(o),
        updatedAt: o.updatedAt.getTime(),
        tombstone: false,
      })),
      ...categories.map((c) => ({
        entity: 'service_category' as const,
        entityId: c.id,
        op: (c.deletedAt ? 'delete' : 'update') as 'delete' | 'update',
        payload: this.categoryToDomain(c),
        updatedAt: c.updatedAt.getTime(),
        tombstone: !!c.deletedAt,
      })),
    ];

    return {
      changes,
      serverTime: Date.now(),
    };
  }

  /**
   * Aplica un batch de operaciones con LWW.
   * Soporta: orders (update), customers (create/update/delete),
   * service_categories (create/update/delete), services (create/update/delete).
   */
  async pushBatch(
    tenantId: string,
    operations: SyncOperation[],
  ): Promise<{ accepted: number; rejected: number }> {
    let accepted = 0;
    let rejected = 0;

    for (const op of operations) {
      try {
        if (op.entity === 'order' && op.op === 'update') {
          await this.applyOrderUpdate(tenantId, op);
          accepted++;
        } else if (op.entity === 'service_category') {
          await this.applyCategoryOp(tenantId, op);
          accepted++;
        } else if (op.entity === 'customer') {
          await this.applyCustomerOp(tenantId, op);
          accepted++;
        } else {
          this.logger.warn(`Sync op not supported: ${op.entity}/${op.op}`);
          rejected++;
        }
      } catch (e) {
        this.logger.error(`Sync op failed: ${op.entity}/${op.op}/${op.entityId}`, e);
        rejected++;
      }
    }

    return { accepted, rejected };
  }

  /**
   * Aplica una op de customer (create/update/delete). Mismo patrón que
   * service_category: LWW con tie-break al server (no pisa si el local
   * del cliente es más viejo).
   */
  private async applyCustomerOp(tenantId: string, op: SyncOperation): Promise<void> {
    const payload = op.payload as Partial<{ name: string; updatedAt: number; [k: string]: unknown }>;

    if (op.op === 'delete') {
      const existing = await this.customerEntityRepo.findOne({
        where: { id: op.entityId, tenantId },
      });
      if (!existing) return;
      if (payload.updatedAt && existing.updatedAt.getTime() > payload.updatedAt) return;
      await this.customerRepo.softDelete(op.entityId, tenantId);
      return;
    }

    const incomingName = payload.name;
    if (!incomingName || typeof incomingName !== 'string') {
      throw new Error(`Customer ${op.entityId} sin name`);
    }

    const existing = await this.customerEntityRepo.findOne({
      where: { id: op.entityId, tenantId },
    });

    if (!existing) {
      // Crear — validamos unique (name, tenant) activo para evitar
      // colisiones con clientes que ya existen en el server.
      const conflict = await this.customerEntityRepo.findOne({
        where: { tenantId, name: incomingName },
      });
      if (conflict && !conflict.deletedAt && conflict.id !== op.entityId) {
        this.logger.warn(
          `Customer conflict on create: ${incomingName} ya existe (${conflict.id}). Skip.`,
        );
        return;
      }
      // Crear con el id del cliente (offline-first). Usamos el
      // customerEntityRepo directamente (no el port) porque necesitamos
      // preservar el id que ya viene del cliente. El port.create()
      // autogeneraría uno nuevo.
      const newCustomer = this.customerEntityRepo.create({
        id: op.entityId,
        tenantId,
        name: incomingName,
        phone: (payload.phone as string | null) ?? null,
        email: (payload.email as string | null) ?? null,
        address: (payload.address as string | null) ?? null,
        notes: (payload.notes as string | null) ?? null,
        rfc: (payload.rfc as string | null) ?? null,
        legalName: (payload.legalName as string | null) ?? null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await this.customerEntityRepo.save(newCustomer);
      return;
    }

    // Update — LWW
    if (payload.updatedAt && existing.updatedAt.getTime() > payload.updatedAt) {
      return; // server más nuevo, skip
    }
    existing.name = incomingName;
    if (payload.phone !== undefined) existing.phone = (payload.phone as string | null) ?? null;
    if (payload.email !== undefined) existing.email = (payload.email as string | null) ?? null;
    if (payload.address !== undefined) existing.address = (payload.address as string | null) ?? null;
    if (payload.notes !== undefined) existing.notes = (payload.notes as string | null) ?? null;
    if (payload.rfc !== undefined) existing.rfc = (payload.rfc as string | null) ?? null;
    if (payload.legalName !== undefined) existing.legalName = (payload.legalName as string | null) ?? null;
    await this.customerEntityRepo.save(existing);
  }

  /**
   * Aplica una op de service_category (create/update/delete).
   * LWW: gana el que tenga updatedAt más reciente (con tie-break al server).
   */
  private async applyCategoryOp(tenantId: string, op: SyncOperation): Promise<void> {
    const payload = op.payload as Partial<ServiceCategory>;
    const existing = await this.categoryRepo.findOne({
      where: { id: op.entityId, tenantId },
    });

    if (op.op === 'delete') {
      if (!existing) return; // ya borrado, idempotente
      // LWW: solo borramos si el local del cliente es más nuevo
      if (payload.updatedAt && existing.updatedAt.getTime() > payload.updatedAt) return;
      await this.categoryRepo.update(
        { id: op.entityId, tenantId },
        { deletedAt: new Date() },
      );
      return;
    }

    // create / update
    const incomingName = payload.name;
    if (!incomingName || typeof incomingName !== 'string') {
      throw new Error(`Category ${op.entityId} sin name`);
    }

    if (!existing) {
      // Crear — verifico unique (name, tenant) activo
      const conflict = await this.categoryRepo.findOne({
        where: { tenantId, name: incomingName },
      });
      if (conflict && !conflict.deletedAt && conflict.id !== op.entityId) {
        // Otro cliente ya creó la misma. Mantengo el existente (server wins on conflict).
        this.logger.warn(
          `Category conflict on create: ${incomingName} ya existe (${conflict.id}). Skip.`,
        );
        return;
      }
      const cat = this.categoryRepo.create({
        id: op.entityId,
        tenantId,
        name: incomingName,
      });
      await this.categoryRepo.save(cat);
      return;
    }

    // Update — LWW
    if (payload.updatedAt && existing.updatedAt.getTime() > payload.updatedAt) {
      // Server tiene versión más nueva. Skip.
      return;
    }
    existing.name = incomingName;
    existing.deletedAt = null;
    await this.categoryRepo.save(existing);
  }

  private async applyOrderUpdate(tenantId: string, op: SyncOperation): Promise<void> {
    const payload = op.payload as Partial<Order>;
    const existing = await this.orderRepo.findOne({
      where: { id: op.entityId, tenantId },
      relations: { items: true },
    });
    if (!existing) {
      // El cliente tenía una order que el server no conoce — la creamos
      const code = await this.nextOrderCode(tenantId);
      const newOrder = new OrderOrmEntity();
      newOrder.id = op.entityId;
      newOrder.tenantId = tenantId;
      newOrder.code = code;
      newOrder.customerId = payload.customerId ?? '';
      newOrder.customerName = payload.customerName ?? 'Cliente';
      newOrder.status = payload.status ?? 'received';
      newOrder.total = String(payload.total ?? 0);
      newOrder.paid = String(payload.paid ?? 0);
      newOrder.balance = String(payload.balance ?? 0);
      newOrder.estimatedDeliveryAt = payload.estimatedDeliveryAt
        ? new Date(payload.estimatedDeliveryAt)
        : undefined;
      newOrder.notes = payload.notes;
      await this.orderRepo.save(newOrder);
      return;
    }

    // LWW: si el local del cliente es más nuevo, gana
    if (payload.updatedAt && payload.updatedAt > existing.updatedAt.getTime()) {
      existing.status = payload.status ?? existing.status;
      existing.total = String(payload.total ?? existing.total);
      existing.paid = String(payload.paid ?? existing.paid);
      existing.balance = String(payload.balance ?? existing.balance);
      existing.notes = payload.notes ?? existing.notes;
      existing.customerName = payload.customerName ?? existing.customerName;
      if (payload.deliveredAt) {
        existing.deliveredAt = new Date(payload.deliveredAt);
      }
      await this.orderRepo.save(existing);
    }
  }

  private async nextOrderCode(tenantId: string): Promise<string> {
    const count = await this.orderRepo.count({ where: { tenantId } });
    return `ORD-${String(count + 1).padStart(4, '0')}`;
  }

  private orderToDomain(o: OrderOrmEntity): Order {
    return {
      id: o.id,
      tenantId: o.tenantId,
      code: o.code,
      customerId: o.customerId,
      customerName: o.customerName,
      status: o.status,
      total: Number(o.total),
      paid: Number(o.paid),
      balance: Number(o.balance),
      notes: o.notes,
      items: (o.items ?? []).map((i: OrderItemOrmEntity) => ({
        id: i.id,
        orderId: i.orderId,
        serviceId: i.serviceId,
        serviceName: i.serviceName,
        unit: i.unit,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
        notes: i.notes,
      })),
      estimatedDeliveryAt: o.estimatedDeliveryAt?.getTime(),
      deliveredAt: o.deliveredAt?.getTime(),
      createdAt: o.createdAt.getTime(),
      updatedAt: o.updatedAt.getTime(),
    };
  }

  private categoryToDomain(c: ServiceCategoryOrmEntity): ServiceCategory {
    return {
      id: c.id,
      tenantId: c.tenantId,
      name: c.name,
      deletedAt: c.deletedAt ? c.deletedAt.getTime() : null,
      createdAt: c.createdAt.getTime(),
      updatedAt: c.updatedAt.getTime(),
    };
  }
}