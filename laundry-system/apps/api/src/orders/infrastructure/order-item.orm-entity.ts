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
// IMPORTANTE: @Index usa nombres de PROPIEDAD, no de columna. TypeORM
// los traduce al nombre real de la columna (que puede ser snake_case
// via `name:` en @Column). Si pones el nombre de la columna directo
// (snake_case) TypeORM lo busca en la entity metadata y falla.
@Index(['orderId'])
export class OrderItemOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Columnas en snake_case en la DB (migration 1700000001000).
  // Especificar `name:` explícitamente para que TypeORM no use el
  // nombre de propiedad (camelCase) en queries auto-generadas.
  // Patrón: SOLO @Column con name, SIN @JoinColumn duplicado.
  // TypeORM detecta la relación por el @ManyToOne y crea la FK column
  // a partir del @Column.
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => OrderOrmEntity, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id', referencedColumnName: 'id' })
  order?: OrderOrmEntity;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId!: string;

  @Column({ name: 'service_name', type: 'varchar', length: 80 })
  serviceName!: string;

  @Column({ name: 'unit', type: 'enum', enum: ['kg', 'piece'] })
  unit!: 'kg' | 'piece';

  @Column({ name: 'quantity', type: 'numeric', precision: 12, scale: 3 })
  quantity!: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ name: 'subtotal', type: 'numeric', precision: 12, scale: 2 })
  subtotal!: string;

  @Column({ name: 'notes', type: 'varchar', length: 200, nullable: true })
  notes?: string;
}