import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { TenantOrmEntity } from './tenants/infrastructure/tenant.orm-entity';
import { UserOrmEntity } from './auth/infrastructure/user.orm-entity';
import { OrderOrmEntity } from './orders/infrastructure/order.orm-entity';
import { OrderItemOrmEntity } from './orders/infrastructure/order-item.orm-entity';
import { CustomerOrmEntity } from './database/entities/customer.orm-entity';
import { ServiceOrmEntity } from './services/infrastructure/entities/service.orm-entity';
import { ServiceCategoryOrmEntity } from './services/infrastructure/entities/service-category.orm-entity';
import { PaymentOrmEntity } from './payments/infrastructure/payment.orm-entity';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { ServicesModule } from './services/services.module';
import { PaymentsModule } from './payments/payments.module';
import { TenantsModule } from './tenants/tenants.module';
import { SyncModule } from './sync/sync.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5433),
        username: config.get<string>('POSTGRES_USER', 'lavanderpro'),
        password: config.get<string>('POSTGRES_PASSWORD', 'lavanderpro'),
        database: config.get<string>('POSTGRES_DB', 'lavanderpro'),
        entities: [
          TenantOrmEntity,
          UserOrmEntity,
          OrderOrmEntity,
          OrderItemOrmEntity,
          CustomerOrmEntity,
          ServiceOrmEntity,
          ServiceCategoryOrmEntity,
          PaymentOrmEntity,
        ],
        migrations: ['dist/database/migrations/*.js'],
        migrationsRun: true,
        synchronize: false,
        logging: ['error', 'warn', 'migration'],
        namingStrategy: new SnakeNamingStrategy(),
      }),
    }),
    TenantsModule,
    AuthModule,
    CustomersModule,
    OrdersModule,
    ServicesModule,
    PaymentsModule,
    SyncModule,
    StorageModule,
    HealthModule,
  ],
})
export class AppModule {}