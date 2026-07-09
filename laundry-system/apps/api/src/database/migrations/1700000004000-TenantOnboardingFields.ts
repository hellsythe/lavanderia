import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TenantOnboardingFields1700000004000
 *
 * Agrega los campos recogidos durante el flujo de onboarding de 3 pasos:
 * - Negocio (datos fiscales)
 * - Sucursal (primera ubicación física)
 * - WhatsApp (verificación)
 *
 * Los campos son nullable hasta que el usuario complete cada paso.
 * `onboarding_step` lleva el contador de progreso (0=nuevo, 3=completo).
 * `onboarding_completed_at` se setea cuando se verifica el WhatsApp (último paso).
 */
export class TenantOnboardingFields1700000004000 implements MigrationInterface {
  name = 'TenantOnboardingFields1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenants
        ADD COLUMN fiscal_name          varchar(120),
        ADD COLUMN fiscal_address       varchar(200),
        ADD COLUMN fiscal_tax_id        varchar(20),
        ADD COLUMN branch_name          varchar(120),
        ADD COLUMN branch_address       varchar(200),
        ADD COLUMN branch_phone         varchar(30),
        ADD COLUMN whatsapp_phone       varchar(30),
        ADD COLUMN whatsapp_verified_at timestamptz,
        ADD COLUMN onboarding_step          smallint NOT NULL DEFAULT 0,
        ADD COLUMN onboarding_completed_at  timestamptz
    `);

    await queryRunner.query(`
      CREATE INDEX idx_tenants_onboarding_completed
        ON tenants(onboarding_completed_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tenants_onboarding_completed`);
    await queryRunner.query(`
      ALTER TABLE tenants
        DROP COLUMN IF EXISTS onboarding_completed_at,
        DROP COLUMN IF EXISTS onboarding_step,
        DROP COLUMN IF EXISTS whatsapp_verified_at,
        DROP COLUMN IF EXISTS whatsapp_phone,
        DROP COLUMN IF EXISTS branch_phone,
        DROP COLUMN IF EXISTS branch_address,
        DROP COLUMN IF EXISTS branch_name,
        DROP COLUMN IF EXISTS fiscal_tax_id,
        DROP COLUMN IF EXISTS fiscal_address,
        DROP COLUMN IF EXISTS fiscal_name
    `);
  }
}