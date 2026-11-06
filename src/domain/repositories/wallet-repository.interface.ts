import { EntityManager } from 'typeorm';
import RepositoryInterface from '../@shared/repository.interface';
import WalletAggregate from '../entities/wallet.aggregate';

export default interface WalletRepositoryInterface extends RepositoryInterface<WalletAggregate> {
  withTransaction(manager: EntityManager): WalletRepositoryInterface;
  findByIdForUpdate(id: string): Promise<WalletAggregate | null>;
  findByPlayerAndCurrency(
    playerId: string,
    currency: string,
  ): Promise<WalletAggregate | null>;
  createNew(wallet: WalletAggregate): Promise<void>;
}
