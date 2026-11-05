import { Check, Column, Entity, ForeignKey, Index, Unique } from 'typeorm';
import BaseModel from './base.model';
import { WagerTransactionModel } from './wager-transaction.model';
import WalletModel from './wallet.model';

@Entity({ name: 'wallet_ledger_entries' })
@Unique('uq_wallet_ledger_entries_transaction_wallet', [
  'transactionId',
  'walletId',
])
@Check('ck_wallet_ledger_entries_direction', `"direction" IN ('DEBIT', 'CREDIT')`)
@Check('ck_wallet_ledger_entries_amount_positive', '"amount" > 0')
@Check(
  'ck_wallet_ledger_entries_balance_nonnegative',
  '"balance_before_amount" >= 0 AND "balance_after_amount" >= 0',
)
@Check(
  'ck_wallet_ledger_entries_currency_consistency',
  'char_length(currency) = 3 AND currency = balance_before_currency AND currency = balance_after_currency',
)
@Check(
  'ck_wallet_ledger_entries_balance_equation',
  `(direction = 'CREDIT' AND balance_after_amount = balance_before_amount + amount) OR (direction = 'DEBIT' AND balance_after_amount = balance_before_amount - amount)`,
)
@ForeignKey(() => WalletModel, ['walletId'], ['id'], {
  name: 'fk_wallet_ledger_entries_wallet',
  onDelete: 'RESTRICT',
})
@ForeignKey(() => WagerTransactionModel, ['transactionId'], ['id'], {
  name: 'fk_wallet_ledger_entries_transaction',
  onDelete: 'RESTRICT',
})
@Index('ix_wallet_ledger_entries_wallet_id', ['walletId'])
export default class WalletLedgerEntryModel extends BaseModel {
  @Column({ type: 'uuid', name: 'wallet_id' })
  declare walletId: string;

  @Column({ type: 'uuid', name: 'transaction_id' })
  declare transactionId: string;

  @Column({ type: 'varchar' })
  declare direction: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  declare amount: string;

  @Column({ type: 'varchar', length: 3 })
  declare currency: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'balance_before_amount',
  })
  declare balanceBeforeAmount: string;

  @Column({ type: 'varchar', length: 3, name: 'balance_before_currency' })
  declare balanceBeforeCurrency: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'balance_after_amount',
  })
  declare balanceAfterAmount: string;

  @Column({ type: 'varchar', length: 3, name: 'balance_after_currency' })
  declare balanceAfterCurrency: string;
}
