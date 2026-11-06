import RepositoryInterface from '../@shared/repository.interface';
import WagerTransaction from '../entities/wager-transaction.entity';

export default interface WagerTransactionRepositoryInterface extends RepositoryInterface<WagerTransaction> {
  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<WagerTransaction | null>;

  findByProviderAndExternalTransactionIdForUpdate(
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransaction | null>;

  findRefundByReferenceTransactionId(
    referenceTransactionId: string,
  ): Promise<WagerTransaction | null>;

  findRollbackByReferenceTransactionId(
    referenceTransactionId: string,
  ): Promise<WagerTransaction | null>;
}
