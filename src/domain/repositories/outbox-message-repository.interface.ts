import RepositoryInterface from '../@shared/repository.interface';
import OutboxMessage from '../entities/outbox-message.entity';

export type ClaimedOutboxEvent = {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: Readonly<Record<string, unknown>>;
  occurredAt: Date;
  attempts: number;
  claimToken: string;
};

export default interface OutboxMessageRepositoryInterface extends RepositoryInterface<OutboxMessage> {
  claimPendingBatch(
    limit: number,
    leaseMs: number,
  ): Promise<ClaimedOutboxEvent[]>;
  markPublished(id: string, claimToken: string): Promise<void>;
  scheduleRetry(
    id: string,
    claimToken: string,
    nextAttemptAt: Date,
  ): Promise<void>;
}
