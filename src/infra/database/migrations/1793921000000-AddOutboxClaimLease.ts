import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutboxClaimLease1793921000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbox_messages"
      ADD COLUMN "claim_token" uuid,
      ADD COLUMN "claimed_until" timestamptz
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_outbox_messages_claim_lease"
      ON "outbox_messages" ("claimed_until")
      WHERE "published_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_outbox_messages_claim_lease"`);
    await queryRunner.query(`
      ALTER TABLE "outbox_messages"
      DROP COLUMN "claimed_until",
      DROP COLUMN "claim_token"
    `);
  }
}
