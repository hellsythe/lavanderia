import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'payments' })
export class PaymentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({
    name: 'method',
    type: 'enum',
    enum: ['cash', 'card', 'transfer', 'points', 'other'],
  })
  method!: 'cash' | 'card' | 'transfer' | 'points' | 'other';

  @Column({ name: 'amount', type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ name: 'reference', type: 'varchar', length: 80, nullable: true })
  reference?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
