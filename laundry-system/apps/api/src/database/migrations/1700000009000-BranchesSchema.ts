import { MigrationInterface, QueryRunner } from 'typeorm';

export class BranchesSchema1700000009000 implements MigrationInterface {
  name = 'BranchesSchema1700000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE branches (
        id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name         varchar(120) NOT NULL,
        address      varchar(200),
        phone        varchar(30),
        is_main      boolean NOT NULL DEFAULT false,
        active       boolean NOT NULL DEFAULT true,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_branches_tenant_id ON branches(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_branches_tenant_active ON branches(tenant_id, active)`,
    );

    // Migrar datos: tenants con branch_name → 1 row en branches
    await queryRunner.query(`
      INSERT INTO branches (id, tenant_id, name, address, phone, is_main, active)
      SELECT
        gen_random_uuid(),
        id,
        COALESCE(branch_name, 'Sucursal Principal'),
        branch_address,
        branch_phone,
        true,
        true
      FROM tenants
      WHERE branch_name IS NOT NULL
    `);

    // Seed: tenant demo sin branch → crear una por default
    await queryRunner.query(`
      INSERT INTO branches (id, tenant_id, name, is_main, active)
      SELECT
        gen_random_uuid(),
        t.id,
        'Sucursal Centro',
        true,
        true
      FROM tenants t
      WHERE t.id = '00000000-0000-0000-0000-000000000001'
        AND NOT EXISTS (
          SELECT 1 FROM branches b WHERE b.tenant_id = t.id
        )
    `);

    // Quitar columnas branch_* de tenants
    await queryRunner.query(`
      ALTER TABLE tenants
        DROP COLUMN IF EXISTS branch_name,
        DROP COLUMN IF EXISTS branch_address,
        DROP COLUMN IF EXISTS branch_phone
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS branch_name    varchar(120),
        ADD COLUMN IF NOT EXISTS branch_address varchar(200),
        ADD COLUMN IF NOT EXISTS branch_phone   varchar(30)
    `);

    await queryRunner.query(`
      UPDATE tenants t
      SET
        branch_name    = (SELECT name FROM branches WHERE tenant_id = t.id AND is_main = true LIMIT 1),
        branch_address = (SELECT address FROM branches WHERE tenant_id = t.id AND is_main = true LIMIT 1),
        branch_phone   = (SELECT phone FROM branches WHERE tenant_id = t.id AND is_main = true LIMIT 1)
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS branches`);
  }
}
