import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantOrmEntity } from '../../../tenants/infrastructure/tenant.orm-entity';
import { ServiceCategoryOrmEntity } from './service-category.orm-entity';

@Entity({ name: 'services' })
// @Index usa nombres de PROPIEDAD. TypeORM los traduce al nombre real
// de la columna (snake_case via @Column.name).
@Index(['tenantId', 'categoryId'])
@Index(['tenantId', 'name'])
@Index(['tenantId', 'deletedAt'])
export class ServiceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Columnas en snake_case en la DB (migration 1700000003000).
  // Especificar `name:` explícitamente para que TypeORM no use el
  // nombre de propiedad (camelCase) en queries auto-generadas.
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantOrmEntity;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId?: string | null;

  @ManyToOne(() => ServiceCategoryOrmEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category?: ServiceCategoryOrmEntity | null;

  @Column({ name: 'name', type: 'varchar', length: 80 })
  name!: string;

  @Column({ name: 'description', type: 'varchar', length: 300, nullable: true })
  description?: string | null;

  @Column({ name: 'unit', type: 'enum', enum: ['kg', 'piece'] })
  unit!: 'kg' | 'piece';

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2, default: 0 })
  unitPrice!: string;

  @Column({ name: 'min_quantity', type: 'int', default: 1 })
  minQuantity!: number;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true, default: null })
  deletedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
