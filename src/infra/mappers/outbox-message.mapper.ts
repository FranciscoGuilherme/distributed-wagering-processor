import OutboxMessage from '../../domain/entities/outbox-message.entity';
import { OutboxMessageModel } from '../models/outbox-message.model';

export default class OutboxMessageMapper {
  static toEntity(model: OutboxMessageModel): OutboxMessage {
    return new OutboxMessage(
      {
        aggregateId: model.aggregateId,
        eventType: model.eventType,
        payload: model.payload,
        occurredAt: model.occurredAt,
        attempts: model.attempts,
        nextAttemptAt: model.nextAttemptAt ?? undefined,
        publishedAt: model.publishedAt ?? undefined,
      },
      model.id,
    );
  }

  static toPersistence(entity: OutboxMessage): OutboxMessageModel {
    return {
      id: entity.id,
      createdAt: entity.occurredAt,
      aggregateId: entity.aggregateId,
      eventType: entity.eventType,
      payload: entity.payload,
      occurredAt: entity.occurredAt,
      attempts: entity.attempts,
      nextAttemptAt: entity.nextAttemptAt ?? null,
      publishedAt: entity.publishedAt ?? null,
      claimToken: null,
      claimedUntil: null,
    };
  }
}
