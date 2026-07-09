import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ServiceMinQuantity1700000005000
 *
 * Agrega `min_quantity` a la tabla `services` con default 1.
 * Cantidad mínima por defecto al crear un pedido/POS (ej: 1 kg o 1 pz).
 */
export class ServiceMinQuantity1700000005000 implements MigrationInterface {
  name = 'ServiceMinQuantity1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE services
        ADD COLUMN min_quantity integer NOT NULL DEFAULT 1
    `);

    // CHECK constraint: min_quantity >= 1 (siempre positivo, default 1)
    await queryRunner.query(`
      ALTER TABLE services
        ADD CONSTRAINT chk_services_min_quantity CHECK (min_quantity >= 1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE services DROP CONSTRAINT IF EXISTS chk_services_min_quantity
    `);
    await queryRunner.query(`
      ALTER TABLE services DROP COLUMN IF EXISTS min_quantity
    `);
  }
}