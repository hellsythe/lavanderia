import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { SyncChange, SyncOperation, SyncPullResponse } from '@lavanderpro/shared-types';
import { OrderOrmEntity } from '../orders/infrastructure/order.orm-entity';
import { OrderItemOrmEntity } from '../orders/infrastructure/order-item.orm-entity';
import { UserOrmEntity } from '../auth/infrastructure/user.orm-entity';
import { Order } from '../orders/domain/order.entity';

/**
 * SyncService — endpoints para sincronización offline-first.
 *
 * GET /api/sync/changes?since=... → lista de cambios del tenant
 * POST /api/sync/batch → aplica operaciones del cliente (con LWW)
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
  ) {}

  /**
   * Devuelve todos los cambios del tenant con `updatedAt > since`.
   * Por ahora solo orders; customers/services se agregarán cuando existan.
   */
  async getChanges(tenantId: string, since: number): Promise<SyncPullResponse> {
    const orders = await this.orderRepo.find({
      where: { tenantId, updatedAt: since > 0 ? require('typeorm').MoreThan(new Date(since)) : undefined },
      relations: { items: true },
      order: { updatedAt: 'ASC' },
      take: 500, // limit por request
    });

    const changes: SyncChange[] = orders.map((o) => ({
      entity: 'order' as const,
      entityId: o.id,
      op: 'update' as const,
      payload: this.orderToDomain(o),
      updatedAt: o.updatedAt.getTime(),
      tombstone: false,
    }));

    return {
      changes,
      serverTime: Date.now(),
    };
  }

  /**
   * Aplica un batch de operaciones con LWW.
   * Para MVP, soportamos solo entity='order' op='update' (change status).
   * 'create' y 'delete' se agregarán cuando Customers exista.
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
        } else {
          // Entity o operación no soportada aún
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
}