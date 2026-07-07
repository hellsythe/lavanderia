import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreateOrderInputSchema,
  type CreateOrderInput,
  type Order,
  type OrderItem,
  type OrderStatus,
} from '@lavanderpro/shared-types';
import {
  InvalidOrderTransitionError,
  applyTransition,
  recomputeTotals,
} from './domain/order.entity';
import {
  type ListOrdersFilters,
  type ListOrdersResult,
  ORDER_REPOSITORY,
  type OrderRepositoryPort,
} from './ports/order-repository.port';

/**
 * OrdersService — use cases.
 *
 * Para MVP los exponemos como métodos del service (en lugar de un use case
 * por método). Si crece, extraer a clases CreateOrderUseCase, etc.
 */
@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
  ) {}

  async create(input: CreateOrderInput, tenantId: string): Promise<Order> {
    const parsed = CreateOrderInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    if (!parsed.data.customerId && !parsed.data.customerName) {
      throw new BadRequestException(
        'Debes indicar un customerId o un customerName (cliente nuevo)',
      );
    }

    // MVP: si no hay customerId, requerimos uno (módulo customers pendiente).
    if (!parsed.data.customerId) {
      throw new BadRequestException(
        'customerId requerido (módulo customers pendiente de implementación)',
      );
    }

    const customerName = parsed.data.customerName ?? 'Cliente';
    const items: OrderItem[] = parsed.data.items.map((i) => {
      // TODO: cuando exista ServicesRepository, hacer lookup del unitPrice.
      const unitPrice = 0;
      const unit: 'kg' | 'piece' = 'piece';
      const subtotal = unitPrice * i.quantity;
      return {
        id: randomUUID(),
        orderId: '', // se asigna al guardar
        serviceId: i.serviceId,
        serviceName: '', // TODO: lookup
        unit,
        quantity: i.quantity,
        unitPrice,
        subtotal,
        notes: i.notes,
      };
    });

    const { total } = recomputeTotals(items);

    return this.orders.create({
      tenantId,
      customerId: parsed.data.customerId,
      customerName,
      status: 'received',
      total,
      paid: 0,
      balance: total,
      estimatedDeliveryAt: parsed.data.estimatedDeliveryAt,
      notes: parsed.data.notes,
      items,
    });
  }

  async findById(id: string, tenantId: string): Promise<Order> {
    const order = await this.orders.findById(id, tenantId);
    if (!order) {
      throw new NotFoundException(`Pedido ${id} no encontrado`);
    }
    return order;
  }

  async list(tenantId: string, filters: ListOrdersFilters): Promise<ListOrdersResult> {
    return this.orders.list(tenantId, filters);
  }

  async changeStatus(
    id: string,
    tenantId: string,
    newStatus: OrderStatus,
  ): Promise<Order> {
    const order = await this.findById(id, tenantId);
    let updated: Order;
    try {
      updated = applyTransition(order, newStatus);
    } catch (err) {
      if (err instanceof InvalidOrderTransitionError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
    return this.orders.save(updated);
  }

  async countByStatus(tenantId: string): Promise<Record<OrderStatus, number>> {
    return this.orders.countByStatus(tenantId);
  }
}