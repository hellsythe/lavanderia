import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentOrmEntity } from './payment.orm-entity';
import type { Payment } from '../domain/payment.entity';
import {
  type ListPaymentsFilters,
  type ListPaymentsResult,
  type PaymentRepositoryPort,
} from '../ports/payment-repository.port';

/**
 * TypeORM implementation of PaymentRepositoryPort.
 *
 * Multi-tenant: TODAS las queries reciben `tenantId` explícito y lo
 * aplican en WHERE. Nunca confiar en datos del request sin filtrar.
 */
@Injectable()
export class TypeormPaymentRepository implements PaymentRepositoryPort {
  constructor(
    @InjectRepository(PaymentOrmEntity)
    private readonly repo: Repository<PaymentOrmEntity>,
  ) {}

  async create(
    payment: Omit<Payment, 'createdAt' | 'updatedAt'> &
      Partial<Pick<Payment, 'id'>>,
  ): Promise<Payment> {
    const row = this.repo.create({
      id: payment.id, // offline-first: respetamos el id del cliente
      tenantId: payment.tenantId,
      orderId: payment.orderId,
      method: payment.method,
      amount: payment.amount.toFixed(2),
      reference: payment.reference,
    });
    const saved = await this.repo.save(row);
    return this.toDomain(saved);
  }

  async findById(id: string, tenantId: string): Promise<Payment | null> {
    const row = await this.repo.findOne({
      where: { id, tenantId },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(
    tenantId: string,
    filters: ListPaymentsFilters,
  ): Promise<ListPaymentsResult> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId });

    if (filters.orderId) {
      qb.andWhere('p.order_id = :orderId', { orderId: filters.orderId });
    }

    qb.orderBy('p.created_at', 'DESC')
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0);

    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((r) => this.toDomain(r)),
      total,
    };
  }

  async sumByOrderId(
    tenantId: string,
    orderId: string,
  ): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.order_id = :orderId', { orderId })
      .getRawOne<{ total: string }>();

    return Number(result?.total ?? 0);
  }

  private toDomain(row: PaymentOrmEntity): Payment {
    return {
      id: row.id,
      tenantId: row.tenantId,
      orderId: row.orderId,
      method: row.method,
      amount: Number(row.amount),
      reference: row.reference ?? undefined,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }
}
