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

  @Index()
  @Column({ type: 'uuid' })
  tenantId!: string;

  /** "ORD-0001" — único por tenant (composite index) */
  @Index(['tenantId', 'code'], { unique: true })
  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Index()
  @Column({ type: 'uuid' })
  customerId!: string;

  @Column({ type: 'varchar', length: 120 })
  customerName!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: ['received', 'in_process', 'ready', 'delivered', 'cancelled'],
    default: 'received',
  })
  status!: 'received' | 'in_process' | 'ready' | 'delivered' | 'cancelled';

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  paid!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  balance!: string;

  @Column({ type: 'timestamptz', nullable: true })
  estimatedDeliveryAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes?: string;

  @OneToMany(() => OrderItemOrmEntity, (i) => i.order, {
    cascade: true,
  })
  items!: OrderItemOrmEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}