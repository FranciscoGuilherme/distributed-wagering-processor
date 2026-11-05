import { Column, Entity, Unique } from 'typeorm';
import BaseModel from './base.model';

@Entity({ name: 'wager_transactions' })
@Unique('uq_wager_transactions_idempotency_key', ['idempotencyKey'])
export class WagerTransactionModel extends BaseModel {
  @Column({ type: 'string', name: 'provider_id' })
  declare providerId: string;

  @Column({ type: 'string', name: 'external_transaction_id' })
  declare externalTransactionId: string;

  @Column({ type: 'string', name: 'idempotency_key' })
  declare idempotencyKey: string;

  @Column({ type: 'string', name: 'payload_hash' })
  declare payloadHash: string;

  @Column({ type: 'uuid', name: 'wallet_id' })
  declare walletId: string;

  @Column({ type: 'uuid', name: 'player_id' })
  declare playerId: string;

  @Column({ type: 'string', name: 'round_id' })
  declare roundId: string;

  @Column({ type: 'string', name: 'game_id' })
  declare gameId: string;

  @Column({ type: 'string' })
  declare kind: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  declare amount: string;

  @Column({ type: 'string', length: 3 })
  declare currency: string;

  @Column({ type: 'string', name: 'reference_external_transaction_id' })
  declare referenceExternalTransactionId: string;

  @Column({ type: 'string' })
  declare status: string;

  @Column({ type: 'string', name: 'reference_transaction_id', nullable: true })
  declare referenceTransactionId: string | undefined;

  @Column({ type: 'string', nullable: true })
  declare failureCode: string | undefined;

  @Column({ type: 'timestamptz', name: 'created_at' })
  declare processedAt: Date | undefined;
}
