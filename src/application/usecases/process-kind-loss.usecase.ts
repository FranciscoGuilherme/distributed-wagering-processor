import { Inject, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import OperationRejectedError from '../../domain/@shared/errors/operation-rejected.error';
import WagerTransaction from '../../domain/entities/wager-transaction.entity';
import type WalletAggregate from '../../domain/entities/wallet.aggregate';
import type OutboxMessageRepositoryInterface from '../../domain/repositories/outbox-message-repository.interface';
import type WagerTransactionRepositoryInterface from '../../domain/repositories/wager-transaction-repository.interface';
import type WalletRepositoryInterface from '../../domain/repositories/wallet-repository.interface';
import { OUTBOX_MESSAGE_REPOSITORY } from '../../infra/repositories/typeorm/outbox-message.repository';
import { WAGER_TRANSACTION_REPOSITORY } from '../../infra/repositories/typeorm/wager-transaction.repository';
import { WALLET_REPOSITORY } from '../../infra/repositories/typeorm/wallet.repository';
import { SYSTEM_MESSAGES } from '../../shared/constants/system-messages';
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

@Injectable()
export default class ProcessKindLossUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepositoryInterface,
    @Inject(WAGER_TRANSACTION_REPOSITORY)
    private readonly wagerTransactionRepository: WagerTransactionRepositoryInterface,
    @Inject(OUTBOX_MESSAGE_REPOSITORY)
    private readonly outboxMessageRepository: OutboxMessageRepositoryInterface,
  ) {}

  async execute(
    _props: ProcessOperationProps,
    manager: EntityManager,
    transaction: WagerTransaction,
  ): Promise<ProcessOperationResult> {
    const walletRepository = this.walletRepository.withTransaction(manager);
    const transactionRepository =
      this.wagerTransactionRepository.withTransaction(manager);
    const outboxRepository =
      this.outboxMessageRepository.withTransaction(manager);
    let wallet: WalletAggregate | null = null;

    try {
      wallet = await walletRepository.findById(transaction.walletId);
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
        transactionRepository,
        outboxRepository,
      );
    } catch (error) {
      if (!isBusinessRuleError(error)) {
        throw error;
      }
      return markRejected(
        transaction,
        getFailureCode(error),
        wallet ? toBalanceSnapshot(wallet.balance) : undefined,
        transactionRepository,
        outboxRepository,
      );
    }
  }
}
