import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefundReferenceUniqueness1793920000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_wager_transactions_refund_reference"
      ON "wager_transactions" ("reference_transaction_id")
      WHERE "kind" = 'REFUND' AND "reference_transaction_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "uq_wager_transactions_refund_reference"`,
    );
  }
}
