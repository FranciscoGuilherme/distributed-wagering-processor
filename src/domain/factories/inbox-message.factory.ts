import InboxMessage, {
  InboxMessageProps,
} from '../entities/inbox-message.entity';

export default class InboxMessageFactory {
  static create(props: InboxMessageProps): InboxMessage {
    const entity = new InboxMessage(props);
    entity.validate();
    return entity;
  }

  static rehydrate(props: InboxMessageProps): InboxMessage {
    return new InboxMessage(props);
  }
}
