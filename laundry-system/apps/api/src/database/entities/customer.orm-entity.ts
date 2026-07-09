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
// @Index usa nombres de PROPIEDAD. TypeORM los traduce al nombre real
// de la columna (snake_case via @Column.name).
@Index(['tenantId', 'name'])
@Index(['tenantId', 'deletedAt'])
export class CustomerOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Columnas en snake_case en la DB (migration 1700000002000).
  // Especificar `name:` explícitamente para que TypeORM no use el
  // nombre de propiedad (camelCase) en queries auto-generadas.
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantOrmEntity;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  @Column({ name: 'email', type: 'varchar', length: 200, nullable: true })
  email?: string | null;

  @Column({ name: 'address', type: 'varchar', length: 200, nullable: true })
  address?: string | null;

  @Column({ name: 'notes', type: 'varchar', length: 500, nullable: true })
  notes?: string | null;

  // Datos fiscales opcionales (migration 1700000006000). Útiles para
  // facturación — el cliente final puede o no tenerlos.
  @Column({ name: 'rfc', type: 'varchar', length: 13, nullable: true })
  rfc?: string | null;

  @Column({ name: 'legal_name', type: 'varchar', length: 120, nullable: true })
  legalName?: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true, default: null })
  deletedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}