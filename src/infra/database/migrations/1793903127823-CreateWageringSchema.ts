import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWageringSchema1793903127823 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id" uuid NOT NULL,
        "player_id" uuid NOT NULL,
        "currency" varchar(3) NOT NULL,
        "balance_amount" numeric(18, 2) NOT NULL,
        "version" integer NOT NULL,
        "created_at" timestamptz NOT NULL,
        "updated_at" timestamptz NOT NULL,
        CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"),
        CONSTRAINT "uq_wallets_player_currency" UNIQUE ("player_id", "currency"),
        CONSTRAINT "ck_wallets_balance_nonnegative" CHECK ("balance_amount" >= 0),
        CONSTRAINT "ck_wallets_version_positive" CHECK ("version" >= 1),
        CONSTRAINT "ck_wallets_currency_length" CHECK (char_length("currency") = 3)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "wager_transactions" (
        "id" uuid NOT NULL,
        "provider_id" varchar NOT NULL,
        "external_transaction_id" varchar NOT NULL,
        "idempotency_key" varchar NOT NULL,
        "payload_hash" varchar NOT NULL,
        "wallet_id" uuid NOT NULL,
        "player_id" uuid NOT NULL,
        "round_id" varchar NOT NULL,
        "game_id" varchar NOT NULL,
        "kind" varchar NOT NULL,
        "amount" numeric(18, 2) NOT NULL,
        "currency" varchar(3) NOT NULL,
        "reference_external_transaction_id" varchar,
        "status" varchar NOT NULL,
        "reference_transaction_id" uuid,
        "failure_code" varchar,
        "created_at" timestamptz NOT NULL,
        "processed_at" timestamptz,
        "result_balance_amount" numeric(18, 2),
        "result_balance_currency" varchar(3),
        CONSTRAINT "PK_ccc7e453916e6029fee836e1433" PRIMARY KEY ("id"),
        CONSTRAINT "uq_wager_transactions_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "ck_wager_transactions_kind"
          CHECK ("kind" IN ('OPENING', 'BET', 'WIN', 'LOSS', 'REFUND', 'ROLLBACK')),
        CONSTRAINT "ck_wager_transactions_status"
          CHECK ("status" IN ('PENDING', 'PENDING_REFERENCE', 'PROCESSED', 'REJECTED', 'FAILED')),
        CONSTRAINT "ck_wager_transactions_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "ck_wager_transactions_currency_length" CHECK (char_length("currency") = 3),
        CONSTRAINT "ck_wager_transactions_result_balance_pair"
          CHECK (("result_balance_amount" IS NULL) = ("result_balance_currency" IS NULL)),
        CONSTRAINT "ck_wager_transactions_result_balance_currency_length"
          CHECK ("result_balance_currency" IS NULL OR char_length("result_balance_currency") = 3),
        CONSTRAINT "ck_wager_transactions_reference_required"
          CHECK ("kind" NOT IN ('REFUND', 'ROLLBACK') OR
            ("reference_external_transaction_id" IS NOT NULL AND
              length(btrim("reference_external_transaction_id")) > 0)),
        CONSTRAINT "fk_wager_transactions_wallet"
          FOREIGN KEY ("wallet_id") REFERENCES "wallets" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_wager_transactions_reference"
          FOREIGN KEY ("reference_transaction_id") REFERENCES "wager_transactions" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_wager_transactions_wallet_id"
      ON "wager_transactions" ("wallet_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "wallet_ledger_entries" (
        "id" uuid NOT NULL,
        "wallet_id" uuid NOT NULL,
        "transaction_id" uuid NOT NULL,
        "direction" varchar NOT NULL,
        "amount" numeric(18, 2) NOT NULL,
        "currency" varchar(3) NOT NULL,
        "balance_before_amount" numeric(18, 2) NOT NULL,
        "balance_before_currency" varchar(3) NOT NULL,
        "balance_after_amount" numeric(18, 2) NOT NULL,
        "balance_after_currency" varchar(3) NOT NULL,
        "created_at" timestamptz NOT NULL,
        CONSTRAINT "PK_d18ec2600fc04a812dc53af2be1" PRIMARY KEY ("id"),
        CONSTRAINT "uq_wallet_ledger_entries_transaction_wallet"
          UNIQUE ("transaction_id", "wallet_id"),
        CONSTRAINT "ck_wallet_ledger_entries_direction"
          CHECK ("direction" IN ('DEBIT', 'CREDIT')),
        CONSTRAINT "ck_wallet_ledger_entries_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "ck_wallet_ledger_entries_balance_nonnegative"
          CHECK ("balance_before_amount" >= 0 AND "balance_after_amount" >= 0),
        CONSTRAINT "ck_wallet_ledger_entries_currency_consistency"
          CHECK (char_length("currency") = 3 AND "currency" = "balance_before_currency" AND "currency" = "balance_after_currency"),
        CONSTRAINT "ck_wallet_ledger_entries_balance_equation"
          CHECK (("direction" = 'CREDIT' AND "balance_after_amount" = "balance_before_amount" + "amount") OR
            ("direction" = 'DEBIT' AND "balance_after_amount" = "balance_before_amount" - "amount")),
        CONSTRAINT "fk_wallet_ledger_entries_wallet"
          FOREIGN KEY ("wallet_id") REFERENCES "wallets" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_wallet_ledger_entries_transaction"
          FOREIGN KEY ("transaction_id") REFERENCES "wager_transactions" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_wallet_ledger_entries_wallet_id"
      ON "wallet_ledger_entries" ("wallet_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "inbox_messages" (
        "id" uuid NOT NULL,
        "consumer_name" varchar NOT NULL,
        "message_id" varchar NOT NULL,
        "payload_hash" varchar NOT NULL,
        "received_at" timestamptz NOT NULL,
        "processed_at" timestamptz,
        "created_at" timestamptz NOT NULL,
        CONSTRAINT "PK_f12cf14472c0a9d19bb57cc8478" PRIMARY KEY ("id"),
        CONSTRAINT "uq_inbox_messages_consumer_message"
          UNIQUE ("consumer_name", "message_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "outbox_messages" (
        "id" uuid NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "event_type" varchar NOT NULL,
        "payload" jsonb NOT NULL,
        "occurred_at" timestamptz NOT NULL,
        "attempts" integer NOT NULL,
        "next_attempt_at" timestamptz,
        "published_at" timestamptz,
        "created_at" timestamptz NOT NULL,
        CONSTRAINT "PK_0171348f527c64b137e4d4f5b66" PRIMARY KEY ("id"),
        CONSTRAINT "ck_outbox_messages_attempts_nonnegative" CHECK ("attempts" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "ix_outbox_messages_pending_retry"
      ON "outbox_messages" ("next_attempt_at", "occurred_at")
      WHERE "published_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "outbox_messages"`);
    await queryRunner.query(`DROP TABLE "inbox_messages"`);
    await queryRunner.query(`DROP TABLE "wallet_ledger_entries"`);
    await queryRunner.query(`DROP TABLE "wager_transactions"`);
    await queryRunner.query(`DROP TABLE "wallets"`);
  }
}
