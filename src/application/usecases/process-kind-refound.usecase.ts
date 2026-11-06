import { Inject, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { EntityManager } from 'typeorm';
import ReferenceTransactionIdMissing from '../../domain/@shared/errors/reference-transaction-id-missing.error';
import RefoundNotAllowedError from '../../domain/@shared/errors/refound-not-allowed.error';
import Money from '../../domain/@shared/value-objects/money.vo';
import WagerTransaction, {
  WagerTransactionStatus,
} from '../../domain/entities/wager-transaction.entity';
import { LedgerDirection } from '../../domain/entities/wallet-ledger-entry.entity';
import OutboxMessageFactory from '../../domain/factories/outbox-message.factory';
import WalletLedgerEntryFactory from '../../domain/factories/wallet-ledger-entry.factory';
import type OutboxMessageRepositoryInterface from '../../domain/repositories/outbox-message-repository.interface';
import type WagerTransactionRepositoryInterface from '../../domain/repositories/wager-transaction-repository.interface';
import type WalletLedgerEntryInterface from '../../domain/repositories/wallet-ledger-entry.interface';
import type WalletRepositoryInterface from '../../domain/repositories/wallet-repository.interface';
import { OUTBOX_MESSAGE_REPOSITORY } from '../../infra/repositories/typeorm/outbox-message.repository';
import { WAGER_TRANSACTION_REPOSITORY } from '../../infra/repositories/typeorm/wager-transaction.repository';
import { WALLET_LEDGER_ENTRY_REPOSITORY } from '../../infra/repositories/typeorm/wallet-ledger-entry.repository';
import { WALLET_REPOSITORY } from '../../infra/repositories/typeorm/wallet.repository';
import type {
  ProcessOperationProps,
  ProcessOperationResult,
} from './process-operation.usecase';

@Injectable()
export default class ProcessKindRefoundUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepositoryInterface,
    @Inject(WALLET_LEDGER_ENTRY_REPOSITORY)
    private readonly walletLedgerEntryRepository: WalletLedgerEntryInterface,
    @Inject(WAGER_TRANSACTION_REPOSITORY)
    private readonly wagerTransactionRepository: WagerTransactionRepositoryInterface,
    @Inject(OUTBOX_MESSAGE_REPOSITORY)
    private readonly outboxMessageRepository: OutboxMessageRepositoryInterface,
  ) {}

  async execute(
    props: ProcessOperationProps,
    manager: EntityManager,
    wagerTransaction: WagerTransaction,
  ): Promise<ProcessOperationResult> {
    const walletRepository = this.walletRepository.withTransaction(manager);
    const walletLedgerEntryRepository =
      this.walletLedgerEntryRepository.withTransaction(manager);
    const wagerTransactionRepository =
      this.wagerTransactionRepository.withTransaction(manager);
    const outboxMessageRepository =
      this.outboxMessageRepository.withTransaction(manager);

    if (!props.referenceExternalTransactionId) {
      throw new ReferenceTransactionIdMissing(
        'referenceExternalTransactionId not found',
      );
    }

    await wagerTransactionRepository.create(wagerTransaction);

    const wagerTransactionReference =
      await wagerTransactionRepository.findByProviderAndExternalTransactionIdForUpdate(
        props.providerId,
        props.referenceExternalTransactionId,
      );

    if (!wagerTransactionReference) {
      wagerTransaction.markPendingReference();
      await wagerTransactionRepository.create(wagerTransaction);
      await outboxMessageRepository.create(
        OutboxMessageFactory.create({
          aggregateId: wagerTransaction.id,
          eventType: 'WagerTransactionPendingReference',
          payload: {
            transactionId: wagerTransaction.id,
            providerId: props.providerId,
            externalTransactionId: props.externalTransactionId,
            referenceExternalTransactionId:
              props.referenceExternalTransactionId,
            status: WagerTransactionStatus.PendingReference,
          },
          occurredAt: wagerTransaction.createdAt,
          attempts: 0,
        }),
      );

      return {
        transactionId: wagerTransaction.id,
        status: wagerTransaction.status,
        idempotentReplay: false,
      };
    }

    if (!wagerTransactionReference.isAllowedToRefound()) {
      throw new RefoundNotAllowedError('Only a processed BET can be refunded');
    }

    if (
      wagerTransactionReference.providerId !== wagerTransaction.providerId ||
      wagerTransactionReference.playerId !== wagerTransaction.playerId ||
      wagerTransactionReference.walletId !== wagerTransaction.walletId ||
      wagerTransactionReference.roundId !== wagerTransaction.roundId ||
      wagerTransactionReference.money.value.currency !==
        wagerTransaction.money.value.currency ||
      !wagerTransactionReference.money.value.amount.equals(
        wagerTransaction.money.value.amount,
      )
    ) {
      throw new RefoundNotAllowedError(
        'The refund must match the referenced BET context and amount',
      );
    }

    const existingRefund =
      await wagerTransactionRepository.findRefundByReferenceTransactionId(
        wagerTransactionReference.id,
      );
    if (existingRefund) {
      throw new RefoundNotAllowedError(
        'The referenced BET has already been refunded',
      );
    }

    const wallet = await walletRepository.findByIdForUpdate(
      wagerTransaction.walletId,
    );
    if (!wallet) {
      throw new Error(`Wallet not found: ${wagerTransaction.walletId}`);
    }
    if (
      wallet.playerId !== wagerTransaction.playerId ||
      wallet.currency !== wagerTransaction.money.value.currency ||
      wallet.balance.value.currency !== wagerTransaction.money.value.currency
    ) {
      throw new RefoundNotAllowedError(
        'The wallet owner or currency does not match the refund',
      );
    }

    const money = new Money({
      amount: new Decimal(props.money.amount),
      currency: props.money.currency,
    });
    const balanceBefore = wallet.balance;
    wallet.credit(money);
    const balanceAfter = {
      amount: wallet.balance.value.amount.toFixed(2),
      currency: wallet.balance.value.currency,
    };

    wagerTransaction.setReferenceTransactionId(wagerTransactionReference.id);
    await wagerTransactionRepository.create(wagerTransaction);
    await walletRepository.create(wallet);
    await walletLedgerEntryRepository.create(
      WalletLedgerEntryFactory.create({
        walletId: wallet.id,
        transactionId: wagerTransaction.id,
        direction: LedgerDirection.Credit,
        money: {
          amount: money.value.amount.toFixed(2),
          currency: money.value.currency,
        },
        balanceBefore: {
          amount: balanceBefore.value.amount.toFixed(2),
          currency: balanceBefore.value.currency,
        },
        balanceAfter,
        createdAt: wagerTransaction.createdAt,
      }),
    );

    wagerTransaction.markProcessed(balanceAfter);
    await wagerTransactionRepository.create(wagerTransaction);
    await outboxMessageRepository.create(
      OutboxMessageFactory.create({
        aggregateId: wagerTransaction.id,
        eventType: 'WagerTransactionProcessed',
        payload: {
          transactionId: wagerTransaction.id,
          kind: wagerTransaction.kind,
          referenceTransactionId: wagerTransactionReference.id,
          status: wagerTransaction.status,
          resultBalance: balanceAfter,
        },
        occurredAt: wagerTransaction.createdAt,
        attempts: 0,
      }),
    );
    await outboxMessageRepository.create(
      OutboxMessageFactory.create({
        aggregateId: wallet.id,
        eventType: 'WalletBalanceChanged',
        payload: {
          walletId: wallet.id,
          transactionId: wagerTransaction.id,
          balanceBefore: {
            amount: balanceBefore.value.amount.toFixed(2),
            currency: balanceBefore.value.currency,
          },
          balanceAfter,
        },
        occurredAt: wagerTransaction.createdAt,
        attempts: 0,
      }),
    );

    return {
      transactionId: wagerTransaction.id,
      status: wagerTransaction.status,
      balance: balanceAfter,
      idempotentReplay: false,
    };
  }
}
