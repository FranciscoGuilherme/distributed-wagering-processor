import InboxMessage from '../../domain/entities/inbox-message.entity';
import { InboxMessageModel } from '../models/inbox-message.model';

export default class InboxMessageMapper {
  static toEntity(model: InboxMessageModel): InboxMessage {
    return new InboxMessage(
      {
        consumerName: model.consumerName,
        payloadHash: model.payloadHash,
        receivedAt: model.receivedAt,
        processedAt: model.processedAt ?? undefined,
      },
      model.id,
    );
  }

  static toPersistence(entity: InboxMessage): InboxMessageModel {
    return {
      id: entity.id,
      createdAt: entity.receivedAt,
      consumerName: entity.consumerName,
      payloadHash: entity.payloadHash,
      receivedAt: entity.receivedAt,
      processedAt: entity.processedAt ?? null,
    };
  }
}
