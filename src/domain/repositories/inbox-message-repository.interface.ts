import RepositoryInterface from '../@shared/repository.interface';
import InboxMessage from '../entities/inbox-message.entity';

export default interface InboxMessageRepositoryInterface extends RepositoryInterface<InboxMessage> {
  findByConsumerAndMessageId(
    consumerName: string,
    messageId: string,
  ): Promise<InboxMessage | null>;
}
