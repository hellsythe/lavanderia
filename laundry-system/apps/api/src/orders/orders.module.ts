import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderOrmEntity } from './infrastructure/order.orm-entity';
import { OrderItemOrmEntity } from './infrastructure/order-item.orm-entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ORDER_REPOSITORY } from './ports/order-repository.port';
import { TypeormOrderRepository } from './infrastructure/typeorm-order.repository';

@Module({
  imports: [TypeOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity])],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    {
      provide: ORDER_REPOSITORY,
      useClass: TypeormOrderRepository,
    },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}