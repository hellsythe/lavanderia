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
// @Index usa nombres de PROPIEDAD. TypeORM los traduce al nombre real
// de la columna (snake_case via @Column.name).
@Index(['tenantId', 'name'])
export class ServiceCategoryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Las columnas están en snake_case en la DB (migration 1700000003000).
  // Especificar `name:` explícitamente para que TypeORM no use el
  // nombre de propiedad (camelCase) en queries auto-generadas.
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantOrmEntity;

  @Column({ name: 'name', type: 'varchar', length: 60 })
  name!: string;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true, default: null })
  deletedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
