import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItemOrmEntity } from './order-item.orm-entity';

@Entity({ name: 'orders' })
export class OrderOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Columnas en snake_case en la DB (migration 1700000001000).
  // Especificar `name:` explícitamente para que TypeORM no use el
  // nombre de propiedad (camelCase) en queries auto-generadas.
  @Index()
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  /** "ORD-0001" — único por tenant (composite index) */
  // @Index usa nombres de PROPIEDAD. TypeORM los traduce al nombre real
  // de la columna (snake_case via @Column.name).
  @Index(['tenantId', 'code'], { unique: true })
  @Column({ name: 'code', type: 'varchar', length: 20 })
  code!: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 120 })
  customerName!: string;

  @Index()
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId?: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: ['received', 'in_process', 'ready', 'delivered', 'cancelled'],
    default: 'received',
  })
  status!: 'received' | 'in_process' | 'ready' | 'delivered' | 'cancelled';

  @Column({ name: 'total', type: 'numeric', precision: 12, scale: 2, default: 0 })
  total!: string;

  @Column({ name: 'paid', type: 'numeric', precision: 12, scale: 2, default: 0 })
  paid!: string;

  @Column({ name: 'balance', type: 'numeric', precision: 12, scale: 2, default: 0 })
  balance!: string;

  @Column({ name: 'estimated_delivery_at', type: 'timestamptz', nullable: true })
  estimatedDeliveryAt?: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  @Column({ name: 'notes', type: 'varchar', length: 500, nullable: true })
  notes?: string;

  @OneToMany(() => OrderItemOrmEntity, (i) => i.order, {
    cascade: true,
  })
  items!: OrderItemOrmEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}