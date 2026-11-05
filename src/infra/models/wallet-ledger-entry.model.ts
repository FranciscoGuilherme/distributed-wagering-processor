import { Column, Entity } from 'typeorm';
import BaseModel from './base.model';

@Entity({ name: 'wallet_ledger_entries' })
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
