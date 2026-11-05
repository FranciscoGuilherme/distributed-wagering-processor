import { Column, Entity } from 'typeorm';
import BaseModel from './base.model';

@Entity({ name: 'wallets' })
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
