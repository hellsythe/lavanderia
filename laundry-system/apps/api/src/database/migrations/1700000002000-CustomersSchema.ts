import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomersSchema1700000002000 implements MigrationInterface {
  name = 'CustomersSchema1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE customers (
        id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name         varchar(120) NOT NULL,
        phone        varchar(30),
        email        varchar(200),
        address      varchar(200),
        notes        varchar(500),
        deleted_at   timestamptz,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_customers_tenant_id ON customers(tenant_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_customers_tenant_name ON customers(tenant_id, name)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_customers_tenant_active ON customers(tenant_id, deleted_at)
    `);

    // Seed: customer "Cliente Walk-in" para el tenant demo
    await queryRunner.query(
      `
      INSERT INTO customers (id, tenant_id, name, notes)
      VALUES (
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'Cliente Walk-in',
        'Cliente genérico para ventas sin registro previo'
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS customers`);
  }
}