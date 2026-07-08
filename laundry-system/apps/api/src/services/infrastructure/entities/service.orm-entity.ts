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
@Index(['tenantId', 'categoryId'])
@Index(['tenantId', 'name'])
@Index(['tenantId', 'deletedAt'])
export class ServiceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant?: TenantOrmEntity;

  @Column({ type: 'uuid', nullable: true })
  categoryId?: string | null;

  @ManyToOne(() => ServiceCategoryOrmEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category?: ServiceCategoryOrmEntity | null;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description?: string | null;

  @Column({ type: 'enum', enum: ['kg', 'piece'] })
  unit!: 'kg' | 'piece';

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  unitPrice!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  deletedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
