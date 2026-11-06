import { Column, Entity, Unique } from 'typeorm';
import { POSTGRES_CONSTRAINTS } from '../database/postgres-errors';
import BaseModel from './base.model';

@Entity({ name: 'inbox_messages' })
@Unique(POSTGRES_CONSTRAINTS.INBOX_CONSUMER_MESSAGE, [
  'consumerName',
  'messageId',
])
export class InboxMessageModel extends BaseModel {
  @Column({ type: 'varchar', name: 'consumer_name' })
  declare consumerName: string;

  @Column({ type: 'varchar', name: 'message_id' })
  declare messageId: string;

  @Column({ type: 'varchar', name: 'payload_hash' })
  declare payloadHash: string;

  @Column({ type: 'timestamptz', name: 'received_at' })
  declare receivedAt: Date;

  @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
  declare processedAt: Date | null;
}
