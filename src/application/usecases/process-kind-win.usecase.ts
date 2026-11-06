import Decimal from 'decimal.js';
import OperationRejectedError from '../../domain/@shared/errors/operation-rejected.error';
import Money from '../../domain/@shared/value-objects/money.vo';
import WagerTransaction from '../../domain/entities/wager-transaction.entity';
import { LedgerDirection } from '../../domain/entities/wallet-ledger-entry.entity';
import type WalletAggregate from '../../domain/entities/wallet.aggregate';
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

export default class ProcessKindWinUseCase {
  async execute(
    props: ProcessOperationProps,
    scope: TransactionScope,
    transaction: WagerTransaction,
  ): Promise<ProcessOperationResult> {
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
      if (
        wallet.playerId !== transaction.playerId ||
        wallet.currency !== transaction.money.value.currency ||
        wallet.balance.value.currency !== transaction.money.value.currency
      ) {
        throw new OperationRejectedError(
          SYSTEM_MESSAGES.APPLICATION.WALLET_CONTEXT_MISMATCH,
        );
      }

      const money = new Money({
        amount: new Decimal(props.money.amount),
        currency: props.money.currency,
      });
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
