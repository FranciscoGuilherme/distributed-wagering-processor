import { Check, Column, Entity, Index } from 'typeorm';
import BaseModel from './base.model';

@Entity({ name: 'outbox_messages' })
@Check('ck_outbox_messages_attempts_nonnegative', '"attempts" >= 0')
@Index('ix_outbox_messages_pending_retry', ['nextAttemptAt', 'occurredAt'], {
  where: '"published_at" IS NULL',
})
export class OutboxMessageModel extends BaseModel {
  @Column({ type: 'uuid', name: 'aggregate_id' })
  declare aggregateId: string;

  @Column({ type: 'varchar', name: 'event_type' })
  declare eventType: string;

  @Column({ type: 'jsonb' })
  declare payload: Readonly<Record<string, unknown>>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  declare occurredAt: Date;

  @Column({ type: 'integer', name: 'attempts' })
  declare attempts: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz', nullable: true })
  declare nextAttemptAt: Date | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  declare publishedAt: Date | null;
}
