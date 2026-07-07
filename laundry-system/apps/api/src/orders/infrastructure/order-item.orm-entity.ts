import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderOrmEntity } from './order.orm-entity';

@Entity({ name: 'order_items' })
@Index(['orderId'])
export class OrderItemOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => OrderOrmEntity, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn()
  order?: OrderOrmEntity;

  @Column({ type: 'uuid' })
  serviceId!: string;

  @Column({ type: 'varchar', length: 80 })
  serviceName!: string;

  @Column({ type: 'enum', enum: ['kg', 'piece'] })
  unit!: 'kg' | 'piece';

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  quantity!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  subtotal!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  notes?: string;
}