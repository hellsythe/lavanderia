import { MigrationInterface, QueryRunner } from 'typeorm';

interface SeedOrderItem {
  name: string;
  unit: 'kg' | 'piece';
  qty: number;
  price: number;
  subtotal: number;
}

interface SeedOrder {
  code: string;
  customer: string;
  status: 'received' | 'in_process' | 'ready' | 'delivered' | 'cancelled';
  items: SeedOrderItem[];
  since?: number; // minutos atrás desde ahora (created_at)
  deliveredAgoMin?: number; // minutos atrás desde ahora (delivered_at + created_at)
  notes?: string;
}

export class OrdersSchema1700000001000 implements MigrationInterface {
  name = 'OrdersSchema1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE orders_status_enum AS ENUM (
        'received', 'in_process', 'ready', 'delivered', 'cancelled'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE order_items_unit_enum AS ENUM ('kg', 'piece')
    `);

    await queryRunner.query(`
      CREATE TABLE orders (
        id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        code                   varchar(20) NOT NULL,
        customer_id            uuid NOT NULL,
        customer_name          varchar(120) NOT NULL,
        status                 orders_status_enum NOT NULL DEFAULT 'received',
        total                  numeric(12,2) NOT NULL DEFAULT 0,
        paid                   numeric(12,2) NOT NULL DEFAULT 0,
        balance                numeric(12,2) NOT NULL DEFAULT 0,
        estimated_delivery_at  timestamptz,
        delivered_at           timestamptz,
        notes                  varchar(500),
        created_at             timestamptz NOT NULL DEFAULT now(),
        updated_at             timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_orders_tenant_code UNIQUE (tenant_id, code)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_orders_tenant_id ON orders(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_orders_customer_id ON orders(customer_id)`);
    await queryRunner.query(`CREATE INDEX idx_orders_status ON orders(status)`);
    await queryRunner.query(`CREATE INDEX idx_orders_updated_at ON orders(updated_at)`);

    await queryRunner.query(`
      CREATE TABLE order_items (
        id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        service_id    uuid NOT NULL,
        service_name  varchar(80) NOT NULL,
        unit          order_items_unit_enum NOT NULL,
        quantity      numeric(12,3) NOT NULL,
        unit_price    numeric(12,2) NOT NULL,
        subtotal      numeric(12,2) NOT NULL,
        notes         varchar(200)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_order_items_order_id ON order_items(order_id)`);

    const tenantId = '00000000-0000-0000-0000-000000000001';
    const customerId = '11111111-1111-1111-1111-111111111111';
    const hour = 60 * 60 * 1000;

    const seed: SeedOrder[] = [
      {
        code: 'ORD-0001',
        customer: 'María González',
        status: 'in_process',
        items: [
          { name: 'Lavado Industrial', unit: 'kg', qty: 8.5, price: 12, subtotal: 102 },
          { name: 'Secado', unit: 'kg', qty: 8.5, price: 10, subtotal: 85 },
        ],
        since: 8 * 60 + 15,
        notes: 'Mancha en camisa blanca — proceso delicado',
      },
      {
        code: 'ORD-0002',
        customer: 'Roberto Sánchez',
        status: 'in_process',
        items: [{ name: 'Lavado + Planchado', unit: 'piece', qty: 12, price: 35, subtotal: 420 }],
        since: 8 * 60 + 42,
      },
      {
        code: 'ORD-0003',
        customer: 'Ana Martínez',
        status: 'ready',
        items: [
          { name: 'Lavado Delicado', unit: 'piece', qty: 4, price: 45, subtotal: 180 },
          { name: 'Planchado', unit: 'piece', qty: 4, price: 15, subtotal: 60 },
        ],
        since: 7 * 60 + 30,
      },
      {
        code: 'ORD-0004',
        customer: 'Luis Hernández',
        status: 'received',
        items: [{ name: 'Lavado Estándar', unit: 'kg', qty: 6, price: 14, subtotal: 84 }],
        since: 9 * 60 + 10,
      },
      {
        code: 'ORD-0005',
        customer: 'Patricia Ruiz',
        status: 'ready',
        items: [{ name: 'Tintorería Express', unit: 'piece', qty: 3, price: 80, subtotal: 240 }],
        since: 7 * 60 + 55,
      },
      {
        code: 'ORD-0006',
        customer: 'Jorge Vargas',
        status: 'in_process',
        items: [
          { name: 'Lavado Industrial', unit: 'kg', qty: 15, price: 12, subtotal: 180 },
          { name: 'Secado', unit: 'kg', qty: 15, price: 10, subtotal: 150 },
        ],
        since: 9 * 60 + 25,
        notes: 'Carga completa hotel',
      },
      {
        code: 'ORD-0007',
        customer: 'Hotel Costa Bella',
        status: 'delivered',
        items: [{ name: 'Lavado + Planchado', unit: 'piece', qty: 32, price: 30, subtotal: 960 }],
        deliveredAgoMin: 95,
      },
      {
        code: 'ORD-0008',
        customer: 'Spa Las Palmas',
        status: 'delivered',
        items: [{ name: 'Lavado Toallas', unit: 'kg', qty: 28, price: 11, subtotal: 308 }],
        deliveredAgoMin: 70,
      },
    ];

    const now = Date.now();

    for (const o of seed) {
      const total = o.items.reduce((s, i) => s + i.subtotal, 0);
      const estimated =
        o.status !== 'delivered' ? new Date(now + 24 * hour).toISOString() : null;
      const delivered =
        o.deliveredAgoMin !== undefined
          ? new Date(now - o.deliveredAgoMin * 60 * 1000).toISOString()
          : null;

      // Para órdenes no-delivered: created_at = ahora - since minutos
      // Para delivered: created_at = ahora - deliveredAgoMin minutos (entregado poco después)
      const minutesAgo = o.deliveredAgoMin ?? o.since ?? 60;

      await queryRunner.query(
        `
        INSERT INTO orders
          (tenant_id, code, customer_id, customer_name, status, total, paid, balance,
           estimated_delivery_at, delivered_at, notes, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5::orders_status_enum, $6, $7, $8, $9, $10, $11,
           now() - ($12 || ' minutes')::interval,
           now() - ($12 || ' minutes')::interval)
      `,
        [
          tenantId,
          o.code,
          customerId,
          o.customer,
          o.status,
          total,
          0,
          total,
          estimated,
          delivered,
          o.notes ?? null,
          minutesAgo,
        ],
      );

      const inserted = (await queryRunner.query(
        `SELECT id FROM orders WHERE tenant_id = $1 AND code = $2`,
        [tenantId, o.code],
      )) as Array<{ id: string }>;
      const orderId = inserted[0]?.id;
      if (!orderId) {
        throw new Error(`No se pudo insertar order ${o.code}`);
      }

      for (const it of o.items) {
        await queryRunner.query(
          `
          INSERT INTO order_items
            (order_id, service_id, service_name, unit, quantity, unit_price, subtotal)
          VALUES ($1, $2, $3, $4::order_items_unit_enum, $5, $6, $7)
        `,
          [orderId, globalThis.crypto.randomUUID(), it.name, it.unit, it.qty, it.price, it.subtotal],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS order_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS orders`);
    await queryRunner.query(`DROP TYPE IF EXISTS order_items_unit_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS orders_status_enum`);
  }
}