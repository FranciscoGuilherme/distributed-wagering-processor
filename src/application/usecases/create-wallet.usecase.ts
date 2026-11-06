import Decimal from 'decimal.js';
import { createHash, randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import WalletAlreadyExistsError from '../../domain/@shared/errors/wallet-already-exists.error';
import {
  WagerTransactionKind,
  WagerTransactionStatus,
} from '../../domain/entities/wager-transaction.entity';
import { LedgerDirection } from '../../domain/entities/wallet-ledger-entry.entity';
import WagerTransactionFactory from '../../domain/factories/wager-transaction.factory';
import WalletAggregateFactory from '../../domain/factories/wallet-aggregate.factory';
import WalletLedgerEntryFactory from '../../domain/factories/wallet-ledger-entry.factory';
import type OutboxMessageRepositoryInterface from '../../domain/repositories/outbox-message-repository.interface';
import type WagerTransactionRepositoryInterface from '../../domain/repositories/wager-transaction-repository.interface';
import type WalletLedgerEntryInterface from '../../domain/repositories/wallet-ledger-entry.interface';
import type WalletRepositoryInterface from '../../domain/repositories/wallet-repository.interface';
import { UnitOfWork } from '../../infra/repositories/unit-of-work';
import { SYSTEM_MESSAGES } from '../../shared/constants/system-messages';
import { markProcessed, toBalanceSnapshot } from './process-kind.helpers';

export type CreateWalletProps = {
  playerId: string;
  initialBalance: {
    amount: string;
    currency: string;
  };
};

export default class CreateWalletUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly walletRepository: WalletRepositoryInterface,
    private readonly wagerTransactionRepository: WagerTransactionRepositoryInterface,
    private readonly walletLedgerEntryRepository: WalletLedgerEntryInterface,
    private readonly outboxMessageRepository: OutboxMessageRepositoryInterface,
  ) {}

  execute(props: CreateWalletProps) {
    return this.uow.execute(async (manager: EntityManager) => {
      const wallets = this.walletRepository.withTransaction(manager);
      if (
        await wallets.findByPlayerAndCurrency(
          props.playerId,
          props.initialBalance.currency,
        )
      ) {
        throw new WalletAlreadyExistsError(
          SYSTEM_MESSAGES.PERSISTENCE.WALLET_ALREADY_EXISTS,
        );
      }

      const walletId = randomUUID();
      const now = new Date();
      const amount = props.initialBalance.amount;
      const wallet = WalletAggregateFactory.create({
        id: walletId,
        playerId: props.playerId,
        currency: props.initialBalance.currency,
        balance: { ...props.initialBalance },
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      await wallets.createNew(wallet);

      const balance = toBalanceSnapshot(wallet.balance);
      if (!new Decimal(amount).isPositive()) {
        return {
          id: wallet.id,
          playerId: wallet.playerId,
          balance,
          version: wallet.version,
        };
      }

      const idempotencyKey = `opening:${wallet.id}`;
      const transaction = WagerTransactionFactory.create({
        providerId: 'internal',
        externalTransactionId: idempotencyKey,
        idempotencyKey,
        payloadHash: createHash('sha256')
          .update(
            JSON.stringify({
              kind: WagerTransactionKind.Opening,
              walletId,
              playerId: props.playerId,
              money: {
                amount: props.initialBalance.amount,
                currency: props.initialBalance.currency,
              },
            }),
          )
          .digest('hex'),
        walletId,
        playerId: props.playerId,
        roundId: 'opening',
        gameId: 'internal',
        kind: WagerTransactionKind.Opening,
        money: props.initialBalance,
        status: WagerTransactionStatus.Pending,
      });

      const transactionRepository =
        this.wagerTransactionRepository.withTransaction(manager);
      const ledgerRepository =
        this.walletLedgerEntryRepository.withTransaction(manager);
      const outboxRepository =
        this.outboxMessageRepository.withTransaction(manager);

      await transactionRepository.create(transaction);
      await ledgerRepository.create(
        WalletLedgerEntryFactory.create({
          walletId,
          transactionId: transaction.id,
          direction: LedgerDirection.Credit,
          money: props.initialBalance,
          balanceBefore: {
            amount: '0.00',
            currency: props.initialBalance.currency,
          },
          balanceAfter: balance,
          createdAt: transaction.createdAt,
        }),
      );
      await markProcessed(
        transaction,
        balance,
        transactionRepository,
        outboxRepository,
        {
          id: walletId,
          balanceBefore: {
            amount: '0.00',
            currency: props.initialBalance.currency,
          },
        },
      );

      return {
        id: wallet.id,
        playerId: wallet.playerId,
        balance,
        version: wallet.version,
      };
    });
  }
}
