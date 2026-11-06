import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import OutboxMessage from '../../../domain/entities/outbox-message.entity';
import OutboxMessageRepositoryInterface, {
  type ClaimedOutboxEvent,
} from '../../../domain/repositories/outbox-message-repository.interface';
import OutboxMessageMapper from '../../mappers/outbox-message.mapper';
import { OutboxMessageModel } from '../../models/outbox-message.model';

export const OUTBOX_MESSAGE_REPOSITORY = Symbol('OUTBOX_MESSAGE_REPOSITORY');

@Injectable()
export default class OutboxMessageRepository implements OutboxMessageRepositoryInterface {
  constructor(
    @InjectRepository(OutboxMessageModel)
    private readonly repository: Repository<OutboxMessageModel>,
  ) {}

  async findById(id: string): Promise<OutboxMessage | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? OutboxMessageMapper.toEntity(model) : null;
  }

  async create(entity: OutboxMessage): Promise<void> {
    await this.repository.save(OutboxMessageMapper.toPersistence(entity));
  }

  async claimPendingBatch(
    limit: number,
    leaseMs: number,
  ): Promise<ClaimedOutboxEvent[]> {
    const claimToken = randomUUID();
    return this.repository.manager.transaction(async (manager) => {
      const rows = (await manager.query(
        `WITH candidates AS (
           SELECT id
           FROM outbox_messages
           WHERE published_at IS NULL
             AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
             AND (claimed_until IS NULL OR claimed_until <= NOW())
           ORDER BY occurred_at, id
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         ),
         claimed AS (
           UPDATE outbox_messages AS outbox
           SET claim_token = $2,
             claimed_until = NOW() + ($3::int * INTERVAL '1 millisecond')
           FROM candidates
           WHERE outbox.id = candidates.id
           RETURNING outbox.id, outbox.aggregate_id AS "aggregateId",
                   outbox.event_type AS "eventType", outbox.payload,
                   outbox.occurred_at AS "occurredAt", outbox.attempts
         )
         SELECT id, "aggregateId", "eventType", payload, "occurredAt", attempts
         FROM claimed`,
        [limit, claimToken, leaseMs],
      )) as Array<Omit<ClaimedOutboxEvent, 'claimToken'>>;

      return rows.map((row) => ({ ...row, claimToken }));
    });
  }

  async markPublished(id: string, claimToken: string): Promise<void> {
    await this.repository.manager.query(
      `UPDATE outbox_messages
       SET published_at = NOW(), claim_token = NULL, claimed_until = NULL
       WHERE id = $1 AND claim_token = $2 AND published_at IS NULL`,
      [id, claimToken],
    );
  }

  async scheduleRetry(
    id: string,
    claimToken: string,
    nextAttemptAt: Date,
  ): Promise<void> {
    await this.repository.manager.query(
      `UPDATE outbox_messages
       SET attempts = attempts + 1, next_attempt_at = $3,
           claim_token = NULL, claimed_until = NULL
       WHERE id = $1 AND claim_token = $2 AND published_at IS NULL`,
      [id, claimToken, nextAttemptAt],
    );
  }
}
