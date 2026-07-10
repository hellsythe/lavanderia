import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentsSchema1700000007000 implements MigrationInterface {
  name = 'PaymentsSchema1700000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE payment_method_enum AS ENUM (
        'cash', 'card', 'transfer', 'points', 'other'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE payments (
        id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        order_id     uuid NOT NULL,
        method       payment_method_enum NOT NULL,
        amount       numeric(12,2) NOT NULL CHECK (amount > 0),
        reference    varchar(80),
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_payments_tenant_id ON payments(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_payments_order_id ON payments(order_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_payments_tenant_updated ON payments(tenant_id, updated_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS payments`);
    await queryRunner.query(`DROP TYPE IF EXISTS payment_method_enum`);
  }
}
