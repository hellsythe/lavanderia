import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerOrmEntity } from '../database/entities/customer.orm-entity';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CUSTOMER_REPOSITORY } from './ports/customer-repository.port';
import { TypeormCustomerRepository } from './infrastructure/typeorm-customer.repository';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerOrmEntity])],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: TypeormCustomerRepository,
    },
  ],
  // Exporto CUSTOMER_REPOSITORY para que SyncModule (que también usa el
  // repo) pueda inyectarlo. CustomersService se sigue exportando para
  // el consumer estándar (OrdersService, etc.).
  exports: [CustomersService, CUSTOMER_REPOSITORY],
})
export class CustomersModule {}