import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { TransactionScope } from '../../application/ports/transaction-scope.interface';
import type { UnitOfWork } from '../../application/ports/unit-of-work.interface';
import { InboxMessageModel } from '../models/inbox-message.model';
import { OutboxMessageModel } from '../models/outbox-message.model';
import { WagerTransactionModel } from '../models/wager-transaction.model';
import WalletLedgerEntryModel from '../models/wallet-ledger-entry.model';
import WalletModel from '../models/wallet.model';
import InboxMessageRepository from './typeorm/inbox-message.repository';
import OutboxMessageRepository from './typeorm/outbox-message.repository';
import WagerTransactionRepository from './typeorm/wager-transaction.repository';
import WalletLedgerEntryRepository from './typeorm/wallet-ledger-entry.repository';
import WalletRepository from './typeorm/wallet.repository';

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  execute<T>(operation: (scope: TransactionScope) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager: EntityManager) =>
      operation(this.createScope(manager)),
    );
  }

  private createScope(manager: EntityManager): TransactionScope {
    return {
      wagerTransactionRepository: new WagerTransactionRepository(
        manager.getRepository(WagerTransactionModel),
      ),
      inboxMessageRepository: new InboxMessageRepository(
        manager.getRepository(InboxMessageModel),
      ),
      outboxMessageRepository: new OutboxMessageRepository(
        manager.getRepository(OutboxMessageModel),
      ),
      walletLedgerEntryRepository: new WalletLedgerEntryRepository(
        manager.getRepository(WalletLedgerEntryModel),
      ),
      walletRepository: new WalletRepository(
        manager.getRepository(WalletModel),
      ),
    };
  }
}
