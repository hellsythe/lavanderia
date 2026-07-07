import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { TenantOrmEntity } from '../tenants/infrastructure/tenant.orm-entity';
import { UserOrmEntity } from '../auth/infrastructure/user.orm-entity';
import { OrderOrmEntity } from '../orders/infrastructure/order.orm-entity';
import { OrderItemOrmEntity } from '../orders/infrastructure/order-item.orm-entity';

dotenv.config({ path: '../../.env' });

/**
 * DataSource para CLI de TypeORM (migrations).
 * La app en runtime usa TypeOrmModule.forRootAsync en app.module.ts.
 *
 * Cada entity vive en su módulo — esto es solo el catálogo compartido
 * para la CLI de migraciones.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5433),
  username: process.env.POSTGRES_USER ?? 'lavanderpro',
  password: process.env.POSTGRES_PASSWORD ?? 'lavanderpro',
  database: process.env.POSTGRES_DB ?? 'lavanderpro',
  entities: [TenantOrmEntity, UserOrmEntity, OrderOrmEntity, OrderItemOrmEntity],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
  namingStrategy: new SnakeNamingStrategy(),
});