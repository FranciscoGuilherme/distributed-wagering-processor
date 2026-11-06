import RepositoryInterface from '../@shared/repository.interface';
import WalletAggregate from '../entities/wallet.aggregate';

export default interface WalletRepositoryInterface extends RepositoryInterface<WalletAggregate> {
  findByIdForUpdate(id: string): Promise<WalletAggregate | null>;
  findByPlayerAndCurrency(
    playerId: string,
    currency: string,
  ): Promise<WalletAggregate | null>;
  createNew(wallet: WalletAggregate): Promise<void>;
}
