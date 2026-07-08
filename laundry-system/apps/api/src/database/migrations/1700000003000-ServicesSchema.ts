import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServicesSchema1700000003000 implements MigrationInterface {
  name = 'ServicesSchema1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // === Service Categories ===
    await queryRunner.query(`
      CREATE TABLE service_categories (
        id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name       varchar(60) NOT NULL,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_service_categories_tenant_id ON service_categories(tenant_id)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_service_categories_tenant_name
      ON service_categories(tenant_id, name) WHERE deleted_at IS NULL
    `);

    // === Services ===
    await queryRunner.query(`
      CREATE TABLE services (
        id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL,
        name        varchar(80) NOT NULL,
        description varchar(300),
        unit        varchar(10) NOT NULL CHECK (unit IN ('kg', 'piece')),
        unit_price  numeric(12,2) NOT NULL DEFAULT 0,
        active      boolean NOT NULL DEFAULT true,
        deleted_at  timestamptz,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_services_tenant_id ON services(tenant_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_services_tenant_category ON services(tenant_id, category_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_services_tenant_active ON services(tenant_id, deleted_at, active)
    `);

    // === Seed: 2 categorías demo ===
    await queryRunner.query(`
      INSERT INTO service_categories (tenant_id, name)
      VALUES
        ('00000000-0000-0000-0000-000000000001', 'Servicios generales'),
        ('00000000-0000-0000-0000-000000000001', 'Tintorería')
    `);

    // === Seed: 5 servicios demo ===
    await queryRunner.query(`
      INSERT INTO services (tenant_id, category_id, name, description, unit, unit_price, active)
      SELECT
        '00000000-0000-0000-0000-000000000001',
        c.id,
        s.name,
        s.description,
        s.unit,
        s.unit_price,
        true
      FROM service_categories c
      JOIN (VALUES
        ('Servicios generales', 'Lavado',           'Lavado estándar',                'kg',    12.0),
        ('Servicios generales', 'Secado',           'Secado en máquina',              'kg',    10.0),
        ('Servicios generales', 'Planchado',        'Planchado de prendas',           'piece', 15.0),
        ('Servicios generales', 'Lavado+Planchado', 'Servicio completo',              'piece', 35.0),
        ('Tintorería',         'Tintorería',       'Servicio de tintorería',        'piece', 80.0)
      ) AS s(cat_name, name, description, unit, unit_price) ON s.cat_name = c.name
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS services`);
    await queryRunner.query(`DROP TABLE IF EXISTS service_categories`);
  }
}