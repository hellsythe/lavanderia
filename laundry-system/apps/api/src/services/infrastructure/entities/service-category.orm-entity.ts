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

@Entity({ name: 'service_categories' })
@Index(['tenantId', 'name'])
export class ServiceCategoryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant?: TenantOrmEntity;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  deletedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
