import Decimal from 'decimal.js';
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
import { SYSTEM_MESSAGES } from '../../shared/constants/system-messages';
import type { TransactionScope } from '../ports/transaction-scope.interface';
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

export default class ProcessKindRollbackUseCase {
  async execute(
    props: ProcessOperationProps,
    scope: TransactionScope,
    transaction: WagerTransaction,
  ): Promise<ProcessOperationResult> {
    if (!props.referenceExternalTransactionId) {
      throw new ReferenceTransactionIdMissing(
        SYSTEM_MESSAGES.APPLICATION.REFERENCE_TRANSACTION_ID_REQUIRED,
      );
    }

    const wagerTransactionReference =
      await scope.wagerTransactionRepository.findByProviderAndExternalTransactionIdForUpdate(
        transaction.providerId,
        props.referenceExternalTransactionId,
      );

    if (!wagerTransactionReference) {
      transaction.markPendingReference();
      await scope.wagerTransactionRepository.create(transaction);
      await scope.outboxMessageRepository.create(
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
      wallet = await scope.walletRepository.findByIdForUpdate(
        transaction.walletId,
      );
      if (!wallet) {
        throw new OperationRejectedError(
          SYSTEM_MESSAGES.APPLICATION.WALLET_NOT_FOUND,
        );
      }
      const alreadyReversed =
        await scope.wagerTransactionRepository.findRollbackByReferenceTransactionId(
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
        scope.walletRepository,
        scope.walletLedgerEntryRepository,
      );

      return markProcessed(
        transaction,
        balance,
        scope.wagerTransactionRepository,
        scope.outboxMessageRepository,
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
        scope.wagerTransactionRepository,
        scope.outboxMessageRepository,
      );
    }
  }
}
