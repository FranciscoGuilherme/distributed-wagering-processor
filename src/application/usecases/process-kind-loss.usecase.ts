import OperationRejectedError from '../../domain/@shared/errors/operation-rejected.error';
import WagerTransaction from '../../domain/entities/wager-transaction.entity';
import type WalletAggregate from '../../domain/entities/wallet.aggregate';
import { SYSTEM_MESSAGES } from '../../shared/constants/system-messages';
import type { TransactionScope } from '../ports/transaction-scope.interface';
import {
  getFailureCode,
  isBusinessRuleError,
  markProcessed,
  markRejected,
  toBalanceSnapshot,
} from './process-kind.helpers';
import type {
  ProcessOperationProps,
  ProcessOperationResult,
} from './process-operation.usecase';

export default class ProcessKindLossUseCase {
  async execute(
    _props: ProcessOperationProps,
    scope: TransactionScope,
    transaction: WagerTransaction,
  ): Promise<ProcessOperationResult> {
    let wallet: WalletAggregate | null = null;

    try {
      wallet = await scope.walletRepository.findById(transaction.walletId);
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
      return markProcessed(
        transaction,
        toBalanceSnapshot(wallet.balance),
        scope.wagerTransactionRepository,
        scope.outboxMessageRepository,
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
