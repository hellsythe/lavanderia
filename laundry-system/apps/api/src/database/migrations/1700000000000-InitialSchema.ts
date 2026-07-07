import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extensiones
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);

    // Enum tenant plan
    await queryRunner.query(`
      CREATE TYPE tenants_plan_enum AS ENUM ('trial', 'starter', 'pro', 'enterprise')
    `);

    // Tabla tenants
    await queryRunner.query(`
      CREATE TABLE tenants (
        id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        varchar(100) NOT NULL,
        slug        varchar(40)  NOT NULL UNIQUE,
        plan        tenants_plan_enum NOT NULL DEFAULT 'trial',
        created_at  timestamptz  NOT NULL DEFAULT now(),
        updated_at  timestamptz  NOT NULL DEFAULT now()
      )
    `);

    // Enum user role
    await queryRunner.query(`
      CREATE TYPE users_role_enum AS ENUM (
        'super_admin', 'tenant_admin', 'operator', 'delivery'
      )
    `);

    // Tabla users
    await queryRunner.query(`
      CREATE TABLE users (
        id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email          citext NOT NULL UNIQUE,
        name           varchar(100) NOT NULL,
        role           users_role_enum NOT NULL DEFAULT 'operator',
        password_hash  varchar(255) NOT NULL,
        active         boolean NOT NULL DEFAULT true,
        token_version  integer NOT NULL DEFAULT 1,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_users_tenant_id ON users(tenant_id)`);

    // Seed: tenant + usuario demo
    const passwordHash = await bcrypt.hash('password123', 10);
    await queryRunner.query(
      `
      INSERT INTO tenants (id, name, slug, plan)
      VALUES ('00000000-0000-0000-0000-000000000001', 'LavanderPro Demo', 'demo', 'trial')
    `,
    );

    await queryRunner.query(
      `
      INSERT INTO users (tenant_id, email, name, role, password_hash)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'carlos@lavanderpro.mx',
        'Carlos Méndez',
        'tenant_admin',
        $1
      )
    `,
      [passwordHash],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenants`);
    await queryRunner.query(`DROP TYPE IF EXISTS users_role_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS tenants_plan_enum`);
  }
}