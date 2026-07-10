import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentOrmEntity } from './infrastructure/payment.orm-entity';
import { OrderOrmEntity } from '../orders/infrastructure/order.orm-entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_REPOSITORY } from './ports/payment-repository.port';
import { TypeormPaymentRepository } from './infrastructure/typeorm-payment.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentOrmEntity, OrderOrmEntity]),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_REPOSITORY,
      useClass: TypeormPaymentRepository,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
