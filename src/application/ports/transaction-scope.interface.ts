import type InboxMessageRepositoryInterface from '../../domain/repositories/inbox-message-repository.interface';
import type OutboxMessageRepositoryInterface from '../../domain/repositories/outbox-message-repository.interface';
import type WagerTransactionRepositoryInterface from '../../domain/repositories/wager-transaction-repository.interface';
import type WalletLedgerEntryInterface from '../../domain/repositories/wallet-ledger-entry.interface';
import type WalletRepositoryInterface from '../../domain/repositories/wallet-repository.interface';

export interface TransactionScope {
  wagerTransactionRepository: WagerTransactionRepositoryInterface;
  inboxMessageRepository: InboxMessageRepositoryInterface;
  outboxMessageRepository: OutboxMessageRepositoryInterface;
  walletLedgerEntryRepository: WalletLedgerEntryInterface;
  walletRepository: WalletRepositoryInterface;
}
