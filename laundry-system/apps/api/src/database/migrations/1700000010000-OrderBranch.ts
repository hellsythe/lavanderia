import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderBranch1700000010000 implements MigrationInterface {
  name = 'OrderBranch1700000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN branch_id uuid
    `);
    await queryRunner.query(
      `CREATE INDEX idx_orders_branch_id ON orders(branch_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_branch_id`);
    await queryRunner.query(
      `ALTER TABLE orders DROP COLUMN IF EXISTS branch_id`,
    );
  }
}
