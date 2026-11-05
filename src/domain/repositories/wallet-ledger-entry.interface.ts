import { EntityManager } from 'typeorm';
import RepositoryInterface from '../@shared/repository.interface';
import WalletLedgerEntry from '../entities/wallet-ledger-entry.entity';

export default interface WalletLedgerEntryInterface extends RepositoryInterface<WalletLedgerEntry> {
  withTransaction(manager: EntityManager): WalletLedgerEntryInterface;
}
