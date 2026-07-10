import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantLogoField1700000008000 implements MigrationInterface {
  name = 'TenantLogoField1700000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenants
        ADD COLUMN logo_url varchar(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenants
        DROP COLUMN IF EXISTS logo_url
    `);
  }
}
