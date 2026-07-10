import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreatePaymentInputSchema,
  type CreatePaymentInput,
} from '@lavanderpro/shared-types';
import { OrderOrmEntity } from '../orders/infrastructure/order.orm-entity';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepositoryPort,
} from './ports/payment-repository.port';
import type { Payment } from './domain/payment.entity';

/**
 * PaymentsService — use cases para registrar pagos de un pedido.
 *
 * Al crear un pago:
 *   1. Valida el input (Zod).
 *   2. Verifica que el order pertenece al tenant (seguridad).
 *   3. Crea el payment en DB.
 *   4. Recalcula paid/balance del order sumando todos los payments.
 *   5. Guarda el order actualizado.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepositoryPort,
    @InjectRepository(OrderOrmEntity)
    private readonly orderRepo: Repository<OrderOrmEntity>,
  ) {}

  async create(
    input: CreatePaymentInput,
    tenantId: string,
  ): Promise<Payment> {
    const parsed = CreatePaymentInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Datos de pago inválidos',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const data = parsed.data;

    const order = await this.orderRepo.findOne({
      where: { id: data.orderId, tenantId },
    });
    if (!order) {
      throw new NotFoundException(
        `Pedido ${data.orderId} no encontrado en este negocio`,
      );
    }

    const payment = await this.payments.create({
      tenantId,
      orderId: data.orderId,
      method: data.method,
      amount: data.amount,
      reference: data.reference,
      ...(data.id ? { id: data.id } : {}),
    });

    try {
      await this.recalcOrderTotals(tenantId, data.orderId);
    } catch (e) {
      this.logger.error(
        `[Payments] Error al recalcular totales del pedido ${data.orderId}: ${e}`,
      );
    }

    return payment;
  }

  async listByOrder(
    orderId: string,
    tenantId: string,
  ): Promise<Payment[]> {
    const result = await this.payments.list(tenantId, { orderId });
    return result.items;
  }

  /**
   * Recalcula paid/balance del order a partir de la suma real de payments.
   * Llamado tras cada insert de pago.
   */
  async recalcOrderTotals(
    tenantId: string,
    orderId: string,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, tenantId },
    });
    if (!order) return;

    const totalPaid = await this.payments.sumByOrderId(tenantId, orderId);
    const paid = totalPaid;
    const balance = Math.max(0, Number(order.total) - paid);

    order.paid = paid.toFixed(2);
    order.balance = balance.toFixed(2);
    await this.orderRepo.save(order);
  }
}
