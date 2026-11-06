import { EntityManager } from 'typeorm';
import RepositoryInterface from '../@shared/repository.interface';
import WagerTransaction from '../entities/wager-transaction.entity';

export default interface WagerTransactionRepositoryInterface extends RepositoryInterface<WagerTransaction> {
  withTransaction(manager: EntityManager): WagerTransactionRepositoryInterface;

  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<WagerTransaction | null>;

  findByProviderAndExternalTransactionIdForUpdate(
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransaction | null>;
}
