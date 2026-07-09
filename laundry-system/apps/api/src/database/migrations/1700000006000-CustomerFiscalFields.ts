import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CustomerFiscalFields1700000006000
 *
 * Agrega campos fiscales opcionales a la tabla `customers`:
 * - `rfc` (Registro Federal de Contribuyentes, México) — varchar(13).
 *   Para personas morales (empresas) son 12 chars + homoclave, 13 total.
 *   Para personas físicas son 13 chars.
 *   El cliente puede elegir no capturarlo (cliente final sin datos fiscales).
 * - `legal_name` (razón social) — varchar(120). Para facturación.
 *
 * Ninguno es NOT NULL — son opcionales. El frontend valida que al menos
 * uno de `phone` o `email` esté presente.
 */
export class CustomerFiscalFields1700000006000 implements MigrationInterface {
  name = 'CustomerFiscalFields1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customers
        ADD COLUMN rfc         varchar(13),
        ADD COLUMN legal_name  varchar(120)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customers
        DROP COLUMN IF EXISTS legal_name,
        DROP COLUMN IF EXISTS rfc
    `);
  }
}