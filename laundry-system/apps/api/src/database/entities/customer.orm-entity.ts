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
import { TenantOrmEntity } from '../../tenants/infrastructure/tenant.orm-entity';

/**
 * Customer entity TypeORM.
 * Soft delete: queries siempre filtran por `deleted_at IS NULL`.
 */
@Entity({ name: 'customers' })
@Index(['tenantId', 'name'])
@Index(['tenantId', 'deletedAt'])
export class CustomerOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant?: TenantOrmEntity;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  address?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes?: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  deletedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}