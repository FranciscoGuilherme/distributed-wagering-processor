import { EntityManager } from 'typeorm';
import RepositoryInterface from '../@shared/repository.interface';
import InboxMessage from '../entities/inbox-message.entity';

export default interface InboxMessageRepositoryInterface extends RepositoryInterface<InboxMessage> {
  withTransaction(manager: EntityManager): InboxMessageRepositoryInterface;
  findByConsumerAndMessageId(
    consumerName: string,
    messageId: string,
  ): Promise<InboxMessage | null>;
}
