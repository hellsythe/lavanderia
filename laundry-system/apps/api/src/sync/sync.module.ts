import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderOrmEntity } from '../orders/infrastructure/order.orm-entity';
import { OrderItemOrmEntity } from '../orders/infrastructure/order-item.orm-entity';
import { UserOrmEntity } from '../auth/infrastructure/user.orm-entity';
import { ServiceCategoryOrmEntity } from '../services/infrastructure/entities/service-category.orm-entity';
import { CustomerOrmEntity } from '../database/entities/customer.orm-entity';
import { CustomersModule } from '../customers/customers.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderOrmEntity,
      OrderItemOrmEntity,
      UserOrmEntity,
      ServiceCategoryOrmEntity,
      CustomerOrmEntity,
    ]),
    CustomersModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}