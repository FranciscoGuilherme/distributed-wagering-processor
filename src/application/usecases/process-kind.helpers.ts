import {
  FAILURE_CODES,
  type FailureCode,
} from '../../domain/@shared/constants/failure-codes';
import BalanceError from '../../domain/@shared/errors/balance.error';
import MoneyCurrencyError from '../../domain/@shared/errors/money-currency.error';
import OperationRejectedError from '../../domain/@shared/errors/operation-rejected.error';
import RefoundNotAllowedError from '../../domain/@shared/errors/refound-not-allowed.error';
import Money from '../../domain/@shared/value-objects/money.vo';
import WagerTransaction, {
  type WagerTransactionBalance,
} from '../../domain/entities/wager-transaction.entity';
import { LedgerDirection } from '../../domain/entities/wallet-ledger-entry.entity';
import type WalletAggregate from '../../domain/entities/wallet.aggregate';
import OutboxMessageFactory from '../../domain/factories/outbox-message.factory';
import WalletLedgerEntryFactory from '../../domain/factories/wallet-ledger-entry.factory';
import type OutboxMessageRepositoryInterface from '../../domain/repositories/outbox-message-repository.interface';
import type WagerTransactionRepositoryInterface from '../../domain/repositories/wager-transaction-repository.interface';
import type WalletLedgerEntryInterface from '../../domain/repositories/wallet-ledger-entry.interface';
import type WalletRepositoryInterface from '../../domain/repositories/wallet-repository.interface';
import type { ProcessOperationResult } from './process-operation.usecase';

export function toBalanceSnapshot(money: Money): WagerTransactionBalance {
  return {
    amount: money.value.amount.toFixed(2),
    currency: money.value.currency,
  };
}

export async function persistWalletEffect(
  money: Money,
  wallet: WalletAggregate,
  transaction: WagerTransaction,
  balanceBefore: Money,
  direction: LedgerDirection,
  walletRepository: WalletRepositoryInterface,
  ledgerRepository: WalletLedgerEntryInterface,
): Promise<WagerTransactionBalance> {
  const balanceAfter = toBalanceSnapshot(wallet.balance);
  await walletRepository.create(wallet);
  await ledgerRepository.create(
    WalletLedgerEntryFactory.create({
      walletId: wallet.id,
      transactionId: transaction.id,
      direction,
      money: {
        amount: money.value.amount.toFixed(2),
        currency: money.value.currency,
      },
      balanceBefore: toBalanceSnapshot(balanceBefore),
      balanceAfter,
      createdAt: transaction.createdAt,
    }),
  );
  return balanceAfter;
}

export async function markProcessed(
  transaction: WagerTransaction,
  balance: WagerTransactionBalance,
  transactionRepository: WagerTransactionRepositoryInterface,
  outboxRepository: OutboxMessageRepositoryInterface,
  wallet?: {
    id: string;
    balanceBefore: WagerTransactionBalance;
  },
): Promise<ProcessOperationResult> {
  transaction.markProcessed(balance);
  await transactionRepository.create(transaction);
  await outboxRepository.create(
    OutboxMessageFactory.create({
      aggregateId: transaction.id,
      eventType: 'WagerTransactionProcessed',
      payload: {
        transactionId: transaction.id,
        kind: transaction.kind,
        referenceTransactionId: transaction.referenceTransactionId,
        status: transaction.status,
        resultBalance: balance,
      },
      occurredAt: transaction.createdAt,
      attempts: 0,
    }),
  );
  if (wallet) {
    await outboxRepository.create(
      OutboxMessageFactory.create({
        aggregateId: wallet.id,
        eventType: 'WalletBalanceChanged',
        payload: {
          walletId: wallet.id,
          transactionId: transaction.id,
          balanceBefore: wallet.balanceBefore,
          balanceAfter: balance,
        },
        occurredAt: transaction.createdAt,
        attempts: 0,
      }),
    );
  }
  return {
    transactionId: transaction.id,
    status: transaction.status,
    balance,
    idempotentReplay: false,
    failureCode: transaction.failureCode,
  };
}

export async function markRejected(
  transaction: WagerTransaction,
  failureCode: FailureCode,
  balance: WagerTransactionBalance | undefined,
  transactionRepository: WagerTransactionRepositoryInterface,
  outboxRepository: OutboxMessageRepositoryInterface,
): Promise<ProcessOperationResult> {
  transaction.reject(failureCode, balance);
  await transactionRepository.create(transaction);
  await outboxRepository.create(
    OutboxMessageFactory.create({
      aggregateId: transaction.id,
      eventType: 'WagerTransactionRejected',
      payload: {
        transactionId: transaction.id,
        kind: transaction.kind,
        status: transaction.status,
        failureCode: transaction.failureCode,
      },
      occurredAt: transaction.createdAt,
      attempts: 0,
    }),
  );
  return {
    transactionId: transaction.id,
    status: transaction.status,
    balance,
    idempotentReplay: false,
    failureCode: transaction.failureCode,
  };
}

export function isBusinessRuleError(error: unknown): boolean {
  return (
    error instanceof BalanceError ||
    error instanceof MoneyCurrencyError ||
    error instanceof OperationRejectedError ||
    error instanceof RefoundNotAllowedError
  );
}

export function getFailureCode(
  error: unknown,
  insufficientBalanceCode: FailureCode = FAILURE_CODES.INSUFFICIENT_BALANCE,
): FailureCode {
  if (error instanceof OperationRejectedError) {
    return error.failureCode ?? FAILURE_CODES.BUSINESS_RULE_REJECTED;
  }
  if (error instanceof BalanceError) {
    return insufficientBalanceCode;
  }
  if (error instanceof RefoundNotAllowedError) {
    return FAILURE_CODES.REFUND_NOT_ALLOWED;
  }
  return FAILURE_CODES.BUSINESS_RULE_REJECTED;
}
