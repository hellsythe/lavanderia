import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
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
import { ServicesService } from '../services/services.service';

/**
 * OrdersService — use cases.
 *
 * Para MVP los exponemos como métodos del service (en lugar de un use case
 * por método). Si crece, extraer a clases CreateOrderUseCase, etc.
 *
 * Ahora con lookup de servicios: usa el catálogo (ServiceRepositoryPort)
 * como source of truth para precios; acepta hints del cliente como
 * fallback cuando el servicio no está registrado (offline-first).
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    private readonly servicesService: ServicesService,
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

    if (!parsed.data.customerId) {
      throw new BadRequestException(
        'customerId requerido (módulo customers pendiente de implementación)',
      );
    }

    const customerName = parsed.data.customerName ?? 'Cliente';

    // Construir items con lookup de servicios (source of truth).
    const items: OrderItem[] = [];
    for (const it of parsed.data.items) {
      let svc = null;
      try {
        svc = await this.servicesService.findServiceById(it.serviceId, tenantId);
      } catch {
        // 404 → servicio no encontrado, usamos hints del cliente como fallback
      }

      if (svc) {
        // Servicio conocido: usamos precios/nombres del catálogo
        const subtotal = svc.unitPrice * it.quantity;
        items.push({
          id: randomUUID(),
          orderId: '', // se asigna al guardar
          serviceId: it.serviceId,
          serviceName: svc.name,
          unit: svc.unit,
          quantity: it.quantity,
          unitPrice: svc.unitPrice,
          subtotal,
          notes: it.notes,
        });
      } else {
        // Fallback: hints del cliente (offline-first: el servicio pudo
        // crearse en el catálogo local y aún no llegar al server).
        const hintUnitPrice = it.unitPrice ?? 0;
        const hintServiceName = it.serviceName ?? it.serviceId;
        const hintUnit = it.unit ?? 'piece';
        const subtotal = hintUnitPrice * it.quantity;

        this.logger.warn(
          `Servicio ${it.serviceId} no encontrado en catálogo (tenant ${tenantId}). ` +
            `Usando hints del cliente: ${hintServiceName} @ $${hintUnitPrice}/${hintUnit}.`,
        );

        items.push({
          id: randomUUID(),
          orderId: '',
          serviceId: it.serviceId,
          serviceName: hintServiceName,
          unit: hintUnit,
          quantity: it.quantity,
          unitPrice: hintUnitPrice,
          subtotal,
          notes: it.notes,
        });
      }
    }

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

  async list(
    tenantId: string,
    filters: ListOrdersFilters,
  ): Promise<ListOrdersResult> {
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

  async countByStatus(
    tenantId: string,
  ): Promise<Record<OrderStatus, number>> {
    return this.orders.countByStatus(tenantId);
  }
}
