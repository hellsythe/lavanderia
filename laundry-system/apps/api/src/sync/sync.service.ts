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
import { PaymentOrmEntity } from '../payments/infrastructure/payment.orm-entity';
import { TenantOrmEntity } from '../tenants/infrastructure/tenant.orm-entity';
import { BranchOrmEntity } from '../branches/infrastructure/branch.orm-entity';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepositoryPort,
} from '../customers/ports/customer-repository.port';
import type { Order, OrderItem } from '../orders/domain/order.entity';

/**
 * SyncService — endpoints para sincronización offline-first.
 *
 * GET /api/sync/changes?since=... → lista de cambios del tenant
 * POST /api/sync/batch → aplica operaciones del cliente (con LWW)
 *
 * Soporta: orders (create/update), service_categories, customers, payments.
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
    @InjectRepository(PaymentOrmEntity)
    private readonly paymentRepo: Repository<PaymentOrmEntity>,
    @InjectRepository(TenantOrmEntity)
    private readonly tenantRepo: Repository<TenantOrmEntity>,
    @InjectRepository(BranchOrmEntity)
    private readonly branchRepo: Repository<BranchOrmEntity>,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepo: CustomerRepositoryPort,
  ) {}

  /**
   * Devuelve todos los cambios del tenant con `updatedAt > since`.
   * Incluye orders + categories + payments.
   */
  async getChanges(
    tenantId: string,
    since: number,
  ): Promise<SyncPullResponse> {
    const sinceDate = since > 0 ? new Date(since) : undefined;

    const [orders, categories, payments] = await Promise.all([
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
      this.paymentRepo.find({
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
      ...payments.map((p) => ({
        entity: 'payment' as const,
        entityId: p.id,
        op: 'create' as const,
        payload: this.paymentToDomain(p),
        updatedAt: p.updatedAt.getTime(),
        tombstone: false,
      })),
    ];

    return {
      changes,
      serverTime: Date.now(),
    };
  }

  /**
   * Aplica un batch de operaciones con LWW.
   * Soporta: orders (create/update), customers (create/update/delete),
   * service_categories (create/update/delete), payments (create).
   */
  async pushBatch(
    tenantId: string,
    operations: SyncOperation[],
  ): Promise<{ accepted: number; rejected: number }> {
    let accepted = 0;
    let rejected = 0;

    for (const op of operations) {
      try {
        if (op.entity === 'order') {
          await this.applyOrderOp(tenantId, op);
          accepted++;
        } else if (op.entity === 'service_category') {
          await this.applyCategoryOp(tenantId, op);
          accepted++;
        } else if (op.entity === 'customer') {
          await this.applyCustomerOp(tenantId, op);
          accepted++;
        } else if (op.entity === 'payment') {
          await this.applyPaymentOp(tenantId, op);
          accepted++;
        } else if (op.entity === 'tenant') {
          await this.applyTenantOp(tenantId, op);
          accepted++;
        } else if (op.entity === 'branch') {
          await this.applyBranchOp(tenantId, op);
          accepted++;
        } else {
          this.logger.warn(`Sync op not supported: ${op.entity}/${op.op}`);
          rejected++;
        }
      } catch (e) {
        this.logger.error(
          `Sync op failed: ${op.entity}/${op.op}/${op.entityId}`,
          e,
        );
        rejected++;
      }
    }

    return { accepted, rejected };
  }

  /* -----------------------------------------------------------------------
   * Orders — create + update (con items)
   * ----------------------------------------------------------------------- */

  private async applyOrderOp(
    tenantId: string,
    op: SyncOperation,
  ): Promise<void> {
    const payload = op.payload as Partial<Order> & {
      items?: OrderItem[];
    };
    const existing = await this.orderRepo.findOne({
      where: { id: op.entityId, tenantId },
      relations: { items: true },
    });

    if (!existing) {
      // Crear order que el server no conoce (offline-first).
      await this.createOrderFromSync(tenantId, op.entityId, payload);
      return;
    }

    // Update con LWW: solo pisa si el local del cliente es más nuevo.
    if (payload.updatedAt && payload.updatedAt <= existing.updatedAt.getTime()) {
      return;
    }

    if (payload.status !== undefined)
      existing.status = payload.status;
    if (payload.total !== undefined)
      existing.total = String(payload.total);
    if (payload.paid !== undefined)
      existing.paid = String(payload.paid);
    if (payload.balance !== undefined)
      existing.balance = String(payload.balance);
    if (payload.customerName !== undefined)
      existing.customerName = payload.customerName;
    if (payload.notes !== undefined)
      existing.notes = payload.notes;
    if (payload.deliveredAt !== undefined)
      existing.deliveredAt = new Date(payload.deliveredAt);
    if (payload.estimatedDeliveryAt !== undefined)
      existing.estimatedDeliveryAt = new Date(payload.estimatedDeliveryAt);

    // Items: si el cliente envía items, reconstruir.
    if (payload.items?.length) {
      await this.orderItemRepo.delete({ orderId: op.entityId });
      existing.items = payload.items.map((it) =>
        this.orderItemRepo.create({
          orderId: op.entityId,
          serviceId: it.serviceId,
          serviceName: it.serviceName,
          unit: it.unit,
          quantity: typeof it.quantity === 'number' ? it.quantity.toFixed(3) : String(it.quantity),
          unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice.toFixed(2) : String(it.unitPrice),
          subtotal: typeof it.subtotal === 'number' ? it.subtotal.toFixed(2) : String(it.subtotal),
          notes: it.notes,
        }),
      );
    }

    await this.orderRepo.save(existing);
  }

  private async createOrderFromSync(
    tenantId: string,
    id: string,
    payload: Partial<Order> & { items?: OrderItem[] },
  ): Promise<void> {
    const code = await this.nextOrderCode(tenantId);
    const row = this.orderRepo.create({
      id,
      tenantId,
      code,
      customerId: payload.customerId ?? '',
      customerName: payload.customerName ?? 'Cliente',
      status: payload.status ?? 'received',
      total: String(payload.total ?? 0),
      paid: String(payload.paid ?? 0),
      balance: String(payload.balance ?? 0),
      estimatedDeliveryAt: payload.estimatedDeliveryAt
        ? new Date(payload.estimatedDeliveryAt)
        : undefined,
      deliveredAt: payload.deliveredAt
        ? new Date(payload.deliveredAt)
        : undefined,
      notes: payload.notes,
      branchId: (payload as any).branchId ?? undefined,
    });

    const saved = await this.orderRepo.save(row);

    if (payload.items?.length) {
      const itemRows = payload.items.map((it) =>
        this.orderItemRepo.create({
          orderId: saved.id,
          serviceId: it.serviceId,
          serviceName: it.serviceName,
          unit: it.unit,
          quantity: typeof it.quantity === 'number' ? it.quantity.toFixed(3) : String(it.quantity),
          unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice.toFixed(2) : String(it.unitPrice),
          subtotal: typeof it.subtotal === 'number' ? it.subtotal.toFixed(2) : String(it.subtotal),
          notes: it.notes,
        }),
      );
      await this.orderItemRepo.save(itemRows);
    }
  }

  /* -----------------------------------------------------------------------
   * Payments
   * ----------------------------------------------------------------------- */

  private async applyPaymentOp(
    tenantId: string,
    op: SyncOperation,
  ): Promise<void> {
    if (op.op !== 'create') {
      this.logger.warn(
        `Sync op payment solo permite 'create', recibido: ${op.op}`,
      );
      return;
    }

    const payload = op.payload as Partial<{
      orderId: string;
      method: string;
      amount: number;
      reference?: string;
      updatedAt: number;
    }>;

    const orderId = payload.orderId;
    if (!orderId) {
      this.logger.warn(`Sync payment sin orderId: ${op.entityId}. Skip.`);
      return;
    }

    const existing = await this.paymentRepo.findOne({
      where: { id: op.entityId, tenantId },
    });
    if (existing) return; // idempotente — ya existe

    const existingOrder = await this.orderRepo.findOne({
      where: { id: orderId, tenantId },
    });
    if (!existingOrder) {
      this.logger.warn(
        `Sync payment con order ${orderId} inexistente. Skip.`,
      );
      return;
    }

    const row = this.paymentRepo.create({
      id: op.entityId,
      tenantId,
      orderId,
      method: (payload.method as PaymentOrmEntity['method']) ?? 'other',
      amount: (payload.amount ?? 0).toFixed(2),
      reference: payload.reference,
    });
    await this.paymentRepo.save(row);

    // Recalcular paid/balance del order.
    try {
      await this.recalcOrderTotals(tenantId, orderId);
    } catch (e) {
      this.logger.error(
        `[sync] Error al recalcular totals del order ${orderId}: ${e}`,
      );
    }
  }

  private async recalcOrderTotals(
    tenantId: string,
    orderId: string,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, tenantId },
    });
    if (!order) return;

    const sumResult = await this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.order_id = :orderId', { orderId })
      .getRawOne<{ total: string }>();

    const totalPaid = Number(sumResult?.total ?? 0);
    order.paid = totalPaid.toFixed(2);
    order.balance = Math.max(0, Number(order.total) - totalPaid).toFixed(2);
    await this.orderRepo.save(order);
  }

  /* -----------------------------------------------------------------------
   * Customer
   * ----------------------------------------------------------------------- */

  private async applyCustomerOp(
    tenantId: string,
    op: SyncOperation,
  ): Promise<void> {
    const payload = op.payload as Partial<{
      name: string;
      updatedAt: number;
      [k: string]: unknown;
    }>;

    if (op.op === 'delete') {
      const existing = await this.customerEntityRepo.findOne({
        where: { id: op.entityId, tenantId },
      });
      if (!existing) return;
      if (payload.updatedAt && existing.updatedAt.getTime() > payload.updatedAt)
        return;
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
      const conflict = await this.customerEntityRepo.findOne({
        where: { tenantId, name: incomingName },
      });
      if (conflict && !conflict.deletedAt && conflict.id !== op.entityId) {
        this.logger.warn(
          `Customer conflict on create: ${incomingName} ya existe (${conflict.id}). Skip.`,
        );
        return;
      }
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

    if (payload.updatedAt && existing.updatedAt.getTime() > payload.updatedAt)
      return;

    existing.name = incomingName;
    if (payload.phone !== undefined)
      existing.phone = (payload.phone as string | null) ?? null;
    if (payload.email !== undefined)
      existing.email = (payload.email as string | null) ?? null;
    if (payload.address !== undefined)
      existing.address = (payload.address as string | null) ?? null;
    if (payload.notes !== undefined)
      existing.notes = (payload.notes as string | null) ?? null;
    if (payload.rfc !== undefined)
      existing.rfc = (payload.rfc as string | null) ?? null;
    if (payload.legalName !== undefined)
      existing.legalName = (payload.legalName as string | null) ?? null;
    await this.customerEntityRepo.save(existing);
  }

  /* -----------------------------------------------------------------------
   * Service Category
   * ----------------------------------------------------------------------- */

  private async applyCategoryOp(
    tenantId: string,
    op: SyncOperation,
  ): Promise<void> {
    const payload = op.payload as Partial<ServiceCategory>;
    const existing = await this.categoryRepo.findOne({
      where: { id: op.entityId, tenantId },
    });

    if (op.op === 'delete') {
      if (!existing) return;
      if (
        payload.updatedAt &&
        existing.updatedAt.getTime() > payload.updatedAt
      )
        return;
      await this.categoryRepo.update(
        { id: op.entityId, tenantId },
        { deletedAt: new Date() },
      );
      return;
    }

    const incomingName = payload.name;
    if (!incomingName || typeof incomingName !== 'string') {
      throw new Error(`Category ${op.entityId} sin name`);
    }

    if (!existing) {
      const conflict = await this.categoryRepo.findOne({
        where: { tenantId, name: incomingName },
      });
      if (conflict && !conflict.deletedAt && conflict.id !== op.entityId) {
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

    if (payload.updatedAt && existing.updatedAt.getTime() > payload.updatedAt)
      return;

    existing.name = incomingName;
    existing.deletedAt = null;
    await this.categoryRepo.save(existing);
  }

  /* -----------------------------------------------------------------------
   * Helpers
   * ----------------------------------------------------------------------- */

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
      notes: o.notes ?? undefined,
      items: (o.items ?? []).map((i: OrderItemOrmEntity) => ({
        id: i.id,
        orderId: i.orderId,
        serviceId: i.serviceId,
        serviceName: i.serviceName,
        unit: i.unit,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
        notes: i.notes ?? undefined,
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

  private paymentToDomain(p: PaymentOrmEntity): Record<string, unknown> {
    return {
      id: p.id,
      tenantId: p.tenantId,
      orderId: p.orderId,
      method: p.method,
      amount: Number(p.amount),
      reference: p.reference ?? undefined,
      createdAt: p.createdAt.getTime(),
      updatedAt: p.updatedAt.getTime(),
    };
  }

  /* -----------------------------------------------------------------------
   * Tenant — update de campos configurables (logoUrl, datos empresa)
   * ----------------------------------------------------------------------- */

  private async applyTenantOp(
    tenantId: string,
    op: SyncOperation,
  ): Promise<void> {
    if (op.op !== 'update') {
      this.logger.warn(
        `Sync op tenant solo permite 'update', recibido: ${op.op}`,
      );
      return;
    }

    const payload = op.payload as Partial<{
      name: string;
      fiscalName: string | null;
      fiscalAddress: string | null;
      fiscalTaxId: string | null;
      branchName: string | null;
      branchAddress: string | null;
      branchPhone: string | null;
      whatsappPhone: string | null;
      logoUrl: string | null;
      updatedAt: number;
    }>;

    const existing = await this.tenantRepo.findOne({
      where: { id: op.entityId },
    });
    if (!existing || existing.id !== tenantId) {
      this.logger.warn(
        `Sync tenant ${op.entityId} no encontrado o no pertenece a ${tenantId}`,
      );
      return;
    }

    // LWW: solo pisa si el local es más nuevo.
    if (
      payload.updatedAt &&
      existing.updatedAt.getTime() >= payload.updatedAt
    ) {
      return;
    }

    if (payload.name !== undefined) existing.name = payload.name;
    if (payload.fiscalName !== undefined)
      existing.fiscalName = payload.fiscalName;
    if (payload.fiscalAddress !== undefined)
      existing.fiscalAddress = payload.fiscalAddress;
    if (payload.fiscalTaxId !== undefined)
      existing.fiscalTaxId = payload.fiscalTaxId;
    if (payload.whatsappPhone !== undefined)
      existing.whatsappPhone = payload.whatsappPhone;
    if (payload.logoUrl !== undefined)
      existing.logoUrl = payload.logoUrl;

    await this.tenantRepo.save(existing);
  }

  /* -----------------------------------------------------------------------
   * Branch — upsert desde sync (offline-first)
   * ----------------------------------------------------------------------- */

  private async applyBranchOp(
    tenantId: string,
    op: SyncOperation,
  ): Promise<void> {
    if (op.op !== 'create' && op.op !== 'update') {
      this.logger.warn(
        `Sync op branch solo permite create/update, recibido: ${op.op}`,
      );
      return;
    }

    const payload = op.payload as Partial<{
      name: string;
      address?: string | null;
      phone?: string | null;
      isMain?: boolean;
      active?: boolean;
      updatedAt: number;
    }>;

    const existing = await this.branchRepo.findOne({
      where: { id: op.entityId, tenantId },
    });

    if (!existing) {
      // Crear — offline-first (usamos save directo porque create no acepta id)
      const row = await this.branchRepo.save({
        id: op.entityId,
        tenantId,
        name: payload.name ?? 'Sucursal',
        address: payload.address ?? undefined,
        phone: payload.phone ?? undefined,
        isMain: payload.isMain ?? false,
        active: payload.active ?? true,
      } as BranchOrmEntity);
      void row;
      return;
    }

    // Update LWW
    if (
      payload.updatedAt &&
      existing.updatedAt.getTime() >= payload.updatedAt
    ) {
      return;
    }

    if (payload.name !== undefined) existing.name = payload.name;
    if (payload.address !== undefined)
      existing.address = payload.address ?? undefined;
    if (payload.phone !== undefined)
      existing.phone = payload.phone ?? undefined;
    if (payload.isMain !== undefined)
      existing.isMain = payload.isMain;
    if (payload.active !== undefined)
      existing.active = payload.active;

    await this.branchRepo.save(existing);
  }
}
