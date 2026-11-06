import { Check, Column, Entity, Unique } from 'typeorm';
import { POSTGRES_CONSTRAINTS } from '../database/postgres-errors';
import BaseModel from './base.model';

@Entity({ name: 'wallets' })
@Unique(POSTGRES_CONSTRAINTS.WALLET_PLAYER_CURRENCY, ['playerId', 'currency'])
@Check('ck_wallets_balance_nonnegative', '"balance_amount" >= 0')
@Check('ck_wallets_version_positive', '"version" >= 1')
@Check('ck_wallets_currency_length', 'char_length(currency) = 3')
export default class WalletModel extends BaseModel {
  @Column({ type: 'uuid', name: 'player_id' })
  declare playerId: string;

  @Column({ type: 'varchar', length: 3 })
  declare currency: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'balance_amount' })
  declare balanceAmount: string;

  @Column({ type: 'integer' })
  declare version: number;

  @Column({ type: 'timestamptz', name: 'updated_at' })
  declare updatedAt: Date;
}
