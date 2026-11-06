import Decimal from 'decimal.js';
import OperationRejectedError from '../../domain/@shared/errors/operation-rejected.error';
import ReferenceTransactionIdMissing from '../../domain/@shared/errors/reference-transaction-id-missing.error';
import RefoundNotAllowedError from '../../domain/@shared/errors/refound-not-allowed.error';
import Money from '../../domain/@shared/value-objects/money.vo';
import WagerTransaction, {
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

export default class ProcessKindRefoundUseCase {
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

    const reference =
      await scope.wagerTransactionRepository.findByProviderAndExternalTransactionIdForUpdate(
        transaction.providerId,
        props.referenceExternalTransactionId,
      );
    if (!reference) {
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
      if (!reference.isAllowedToRefound()) {
        throw new RefoundNotAllowedError(
          SYSTEM_MESSAGES.APPLICATION.REFUND_BET_NOT_ALLOWED,
        );
      }
      if (
        reference.providerId !== transaction.providerId ||
        reference.playerId !== transaction.playerId ||
        reference.walletId !== transaction.walletId ||
        reference.roundId !== transaction.roundId ||
        reference.money.value.currency !== transaction.money.value.currency ||
        !reference.money.value.amount.equals(transaction.money.value.amount)
      ) {
        throw new RefoundNotAllowedError(
          SYSTEM_MESSAGES.APPLICATION.REFUND_REFERENCE_MISMATCH,
        );
      }
      if (
        wallet.playerId !== transaction.playerId ||
        wallet.currency !== transaction.money.value.currency ||
        wallet.balance.value.currency !== transaction.money.value.currency
      ) {
        throw new RefoundNotAllowedError(
          SYSTEM_MESSAGES.APPLICATION.REFUND_WALLET_CONTEXT_MISMATCH,
        );
      }
      const existingRefund =
        await scope.wagerTransactionRepository.findRefundByReferenceTransactionId(
          reference.id,
        );
      if (existingRefund) {
        throw new RefoundNotAllowedError(
          SYSTEM_MESSAGES.APPLICATION.REFUND_ALREADY_APPLIED,
        );
      }

      const money = new Money({
        amount: new Decimal(props.money.amount),
        currency: props.money.currency,
      });
      transaction.setReferenceTransactionId(reference.id);
      const balanceBefore = wallet.balance;
      wallet.credit(money);
      const balance = await persistWalletEffect(
        money,
        wallet,
        transaction,
        balanceBefore,
        LedgerDirection.Credit,
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
        getFailureCode(error),
        wallet ? toBalanceSnapshot(wallet.balance) : undefined,
        scope.wagerTransactionRepository,
        scope.outboxMessageRepository,
      );
    }
  }
}
