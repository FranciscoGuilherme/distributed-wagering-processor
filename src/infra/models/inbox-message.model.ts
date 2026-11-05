import { Column, Entity, Unique } from 'typeorm';
import BaseModel from './base.model';

@Entity({ name: 'inbox_messages' })
@Unique('uq_inbox_messages_consumer_payload_hash', [
  'consumerName',
  'payloadHash',
])
export class InboxMessageModel extends BaseModel {
  @Column({ type: 'varchar', name: 'consumer_name' })
  declare consumerName: string;

  @Column({ type: 'varchar', name: 'payload_hash' })
  declare payloadHash: string;

  @Column({ type: 'timestamptz', name: 'received_at' })
  declare receivedAt: Date;

  @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
  declare processedAt: Date | null;
}
