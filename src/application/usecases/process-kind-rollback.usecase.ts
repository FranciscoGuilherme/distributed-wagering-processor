import { Inject, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { EntityManager } from 'typeorm';
import { FAILURE_CODES } from '../../domain/@shared/constants/failure-codes';
import OperationRejectedError from '../../domain/@shared/errors/operation-rejected.error';
import ReferenceTransactionIdMissing from '../../domain/@shared/errors/reference-transaction-id-missing.error';
import Money from '../../domain/@shared/value-objects/money.vo';
import WagerTransaction, {
  WagerTransactionKind,
  WagerTransactionStatus,
} from '../../domain/entities/wager-transaction.entity';
import { LedgerDirection } from '../../domain/entities/wallet-ledger-entry.entity';
import type WalletAggregate from '../../domain/entities/wallet.aggregate';
import OutboxMessageFactory from '../../domain/factories/outbox-message.factory';
import type OutboxMessageRepositoryInterface from '../../domain/repositories/outbox-message-repository.interface';
import type WagerTransactionRepositoryInterface from '../../domain/repositories/wager-transaction-repository.interface';
import type WalletLedgerEntryInterface from '../../domain/repositories/wallet-ledger-entry.interface';
import type WalletRepositoryInterface from '../../domain/repositories/wallet-repository.interface';
import { OUTBOX_MESSAGE_REPOSITORY } from '../../infra/repositories/typeorm/outbox-message.repository';
import { WAGER_TRANSACTION_REPOSITORY } from '../../infra/repositories/typeorm/wager-transaction.repository';
import { WALLET_LEDGER_ENTRY_REPOSITORY } from '../../infra/repositories/typeorm/wallet-ledger-entry.repository';
import { WALLET_REPOSITORY } from '../../infra/repositories/typeorm/wallet.repository';
import { SYSTEM_MESSAGES } from '../../shared/constants/system-messages';
import {
  getFailureCode,
  isBusinessRuleError,
  markProcessed,
  markRejected,
  persistWalletEffect,
  toBalanceSnapshot,
} from './process-kind.helpers';
import type {
  ProcessOperationProps,
  ProcessOperationResult,
} from './process-operation.usecase';

@Injectable()
export default class ProcessKindRollbackUseCase {
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
    transaction: WagerTransaction,
  ): Promise<ProcessOperationResult> {
    const walletRepository = this.walletRepository.withTransaction(manager);
    const ledgerRepository =
      this.walletLedgerEntryRepository.withTransaction(manager);
    const wagerTransactionRepository =
      this.wagerTransactionRepository.withTransaction(manager);
    const outboxRepository =
      this.outboxMessageRepository.withTransaction(manager);

    if (!props.referenceExternalTransactionId) {
      throw new ReferenceTransactionIdMissing(
        SYSTEM_MESSAGES.APPLICATION.REFERENCE_TRANSACTION_ID_REQUIRED,
      );
    }

    const wagerTransactionReference =
      await wagerTransactionRepository.findByProviderAndExternalTransactionIdForUpdate(
        transaction.providerId,
        props.referenceExternalTransactionId,
      );

    if (!wagerTransactionReference) {
      transaction.markPendingReference();
      await wagerTransactionRepository.create(transaction);
      await outboxRepository.create(
        OutboxMessageFactory.create({
          aggregateId: transaction.id,
          eventType: 'WagerTransactionPendingReference',
          payload: {
            transactionId: transaction.id,
            providerId: transaction.providerId,
            externalTransactionId: transaction.externalTransactionId,
            referenceExternalTransactionId:
              transaction.referenceExternalTransactionId,
            status: WagerTransactionStatus.PendingReference,
          },
          occurredAt: transaction.createdAt,
          attempts: 0,
        }),
      );
      return {
        transactionId: transaction.id,
        status: transaction.status,
        idempotentReplay: false,
      };
    }

    let wallet: WalletAggregate | null = null;
    try {
      wallet = await walletRepository.findByIdForUpdate(transaction.walletId);
      if (!wallet) {
        throw new OperationRejectedError(
          SYSTEM_MESSAGES.APPLICATION.WALLET_NOT_FOUND,
        );
      }
      const alreadyReversed =
        await wagerTransactionRepository.findRollbackByReferenceTransactionId(
          wagerTransactionReference.id,
        );
      if (alreadyReversed) {
        throw new OperationRejectedError(
          SYSTEM_MESSAGES.APPLICATION.REFERENCE_ALREADY_ROLLED_BACK,
        );
      }
      if (
        wagerTransactionReference.status !== WagerTransactionStatus.Processed
      ) {
        throw new OperationRejectedError(
          SYSTEM_MESSAGES.APPLICATION.REFERENCE_NOT_PROCESSED,
        );
      }
      if (
        ![
          WagerTransactionKind.Bet,
          WagerTransactionKind.Win,
          WagerTransactionKind.Refund,
        ].includes(wagerTransactionReference.kind)
      ) {
        throw new OperationRejectedError(
          SYSTEM_MESSAGES.APPLICATION.REFERENCE_KIND_NOT_ROLLBACKABLE,
        );
      }
      if (
        wagerTransactionReference.providerId !== transaction.providerId ||
        wagerTransactionReference.playerId !== transaction.playerId ||
        wagerTransactionReference.walletId !== transaction.walletId ||
        wagerTransactionReference.roundId !== transaction.roundId
      ) {
        throw new OperationRejectedError(
          SYSTEM_MESSAGES.APPLICATION.REFERENCE_CONTEXT_MISMATCH,
        );
      }
      if (
        wagerTransactionReference.money.value.currency !==
          transaction.money.value.currency ||
        !wagerTransactionReference.money.value.amount.equals(
          transaction.money.value.amount,
        )
      ) {
        throw new OperationRejectedError(
          SYSTEM_MESSAGES.APPLICATION.ROLLBACK_AMOUNT_MISMATCH,
        );
      }
      if (
        wallet.playerId !== transaction.playerId ||
        wallet.currency !== transaction.money.value.currency ||
        wallet.balance.value.currency !== transaction.money.value.currency
      ) {
        throw new OperationRejectedError(
          SYSTEM_MESSAGES.APPLICATION.ROLLBACK_WALLET_CONTEXT_MISMATCH,
        );
      }

      const money = new Money({
        amount: new Decimal(props.money.amount),
        currency: props.money.currency,
      });
      transaction.setReferenceTransactionId(wagerTransactionReference.id);
      const balanceBefore = wallet.balance;
      const direction =
        wagerTransactionReference.kind === WagerTransactionKind.Bet
          ? LedgerDirection.Credit
          : LedgerDirection.Debit;

      if (direction === LedgerDirection.Credit) {
        wallet.credit(money);
      } else {
        wallet.debit(money);
      }

      const balance = await persistWalletEffect(
        money,
        wallet,
        transaction,
        balanceBefore,
        direction,
        walletRepository,
        ledgerRepository,
      );

      return markProcessed(
        transaction,
        balance,
        wagerTransactionRepository,
        outboxRepository,
        {
          id: wallet.id,
          balanceBefore: toBalanceSnapshot(balanceBefore),
        },
      );
    } catch (error) {
      if (!isBusinessRuleError(error)) {
        throw error;
      }

      return markRejected(
        transaction,
        getFailureCode(error, FAILURE_CODES.ROLLBACK_INSUFFICIENT_BALANCE),
        wallet ? toBalanceSnapshot(wallet.balance) : undefined,
        wagerTransactionRepository,
        outboxRepository,
      );
    }
  }
}
