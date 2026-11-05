import RepositoryInterface from '../@shared/repository.interface';
import OutboxMessage from '../entities/outbox-message.entity';

export default interface OutboxMessageRepositoryInterface extends RepositoryInterface<OutboxMessage> {
  withTransaction(manager: any): OutboxMessageRepositoryInterface;
}
