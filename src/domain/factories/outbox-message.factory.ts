import OutboxMessage, {
  OutboxMessageProps,
} from '../entities/outbox-message.entity';

export default class OutboxMessageFactory {
  static create(props: OutboxMessageProps): OutboxMessage {
    const entity = new OutboxMessage(props);
    entity.validate();
    return entity;
  }

  static rehydrate(props: OutboxMessageProps): OutboxMessage {
    return new OutboxMessage(props);
  }
}
