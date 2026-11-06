import { Check, Column, Entity, ForeignKey, Index, Unique } from 'typeorm';
import BaseModel from './base.model';
import WalletModel from './wallet.model';

@Entity({ name: 'wager_transactions' })
@Unique('uq_wager_transactions_idempotency_key', ['idempotencyKey'])
@Check(
  'ck_wager_transactions_kind',
  `"kind" IN ('OPENING', 'BET', 'WIN', 'LOSS', 'REFUND', 'ROLLBACK')`,
)
@Check(
  'ck_wager_transactions_status',
  `"status" IN ('PENDING', 'PENDING_REFERENCE', 'PROCESSED', 'REJECTED', 'FAILED')`,
)
@Check('ck_wager_transactions_amount_positive', '"amount" > 0')
@Check('ck_wager_transactions_currency_length', 'char_length(currency) = 3')
@Check(
  'ck_wager_transactions_result_balance_pair',
  '("result_balance_amount" IS NULL) = ("result_balance_currency" IS NULL)',
)
@Check(
  'ck_wager_transactions_result_balance_currency_length',
  'result_balance_currency IS NULL OR char_length(result_balance_currency) = 3',
)
@Check(
  'ck_wager_transactions_reference_required',
  `"kind" NOT IN ('REFUND', 'ROLLBACK') OR (reference_external_transaction_id IS NOT NULL AND length(btrim(reference_external_transaction_id)) > 0)`,
)
@ForeignKey(() => WalletModel, ['walletId'], ['id'], {
  name: 'fk_wager_transactions_wallet',
  onDelete: 'RESTRICT',
})
@ForeignKey(() => WagerTransactionModel, ['referenceTransactionId'], ['id'], {
  name: 'fk_wager_transactions_reference',
  onDelete: 'RESTRICT',
})
@Index('ix_wager_transactions_wallet_id', ['walletId'])
@Index(
  'uq_wager_transactions_refund_reference',
  ['referenceTransactionId'],
  {
    unique: true,
    where: `"kind" = 'REFUND' AND "reference_transaction_id" IS NOT NULL`,
  },
)
export class WagerTransactionModel extends BaseModel {
  @Column({ type: 'varchar', name: 'provider_id' })
  declare providerId: string;

  @Column({ type: 'varchar', name: 'external_transaction_id' })
  declare externalTransactionId: string;

  @Column({ type: 'varchar', name: 'idempotency_key' })
  declare idempotencyKey: string;

  @Column({ type: 'varchar', name: 'payload_hash' })
  declare payloadHash: string;

  @Column({ type: 'uuid', name: 'wallet_id' })
  declare walletId: string;

  @Column({ type: 'uuid', name: 'player_id' })
  declare playerId: string;

  @Column({ type: 'varchar', name: 'round_id' })
  declare roundId: string;

  @Column({ type: 'varchar', name: 'game_id' })
  declare gameId: string;

  @Column({ type: 'varchar' })
  declare kind: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  declare amount: string;

  @Column({ type: 'varchar', length: 3 })
  declare currency: string;

  @Column({
    type: 'varchar',
    name: 'reference_external_transaction_id',
    nullable: true,
  })
  declare referenceExternalTransactionId: string | null;

  @Column({ type: 'varchar' })
  declare status: string;

  @Column({ type: 'uuid', name: 'reference_transaction_id', nullable: true })
  declare referenceTransactionId: string | null;

  @Column({ type: 'varchar', name: 'failure_code', nullable: true })
  declare failureCode: string | null;

  @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
  declare processedAt: Date | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'result_balance_amount',
    nullable: true,
  })
  declare resultBalanceAmount: string | null;

  @Column({
    type: 'varchar',
    length: 3,
    name: 'result_balance_currency',
    nullable: true,
  })
  declare resultBalanceCurrency: string | null;
}
