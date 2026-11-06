import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { isUndefined } from 'lodash';
import { EntityManager } from 'typeorm';
import IdempotencyConflictError from '../../domain/@shared/errors/idempotency-conflict.error';
import IdempotencyKeyAlreadyExistsError from '../../domain/@shared/errors/idempotency-key-already-exists.error';
import WagerTransaction, {
  WagerTransactionKind,
  WagerTransactionStatus,
  type WagerTransactionBalance,
} from '../../domain/entities/wager-transaction.entity';
import InboxMessageFactory from '../../domain/factories/inbox-message.factory';
import WagerTransactionFactory from '../../domain/factories/wager-transaction.factory';
import type InboxMessageRepositoryInterface from '../../domain/repositories/inbox-message-repository.interface';
import type WagerTransactionRepositoryInterface from '../../domain/repositories/wager-transaction-repository.interface';
import { INBOX_MESSAGE_REPOSITORY } from '../../infra/repositories/typeorm/inbox-message.repository';
import { WAGER_TRANSACTION_REPOSITORY } from '../../infra/repositories/typeorm/wager-transaction.repository';
import { UnitOfWork } from '../../infra/repositories/unit-of-work';
import ProcessKindBetUseCase from './process-kind-bet.usecase';
import ProcessKindLossUseCase from './process-kind-loss.usecase';
import ProcessKindRefoundUseCase from './process-kind-refound.usecase';
import ProcessKindRollbackUseCase from './process-kind-rollback.usecase';
import ProcessKindWinUseCase from './process-kind-win.usecase';

export type ProcessOperationProps = {
  idempotencyKey: string;
  providerId: string;
  externalTransactionId: string;
  playerId: string;
  walletId: string;
  roundId: string;
  gameId: string;
  kind: string;
  money: {
    amount: string;
    currency: string;
  };
  referenceExternalTransactionId?: string;
  inbox?: {
    consumerName: string;
    messageId: string;
  };
};

export type ProcessOperationResult = {
  transactionId: string;
  status: WagerTransactionStatus;
  balance?: WagerTransactionBalance;
  idempotentReplay: boolean;
};

@Injectable()
export default class ProcessOperationUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(WAGER_TRANSACTION_REPOSITORY)
    private readonly wagerTransactionRepository: WagerTransactionRepositoryInterface,
    @Inject(INBOX_MESSAGE_REPOSITORY)
    private readonly inboxMessageRepository: InboxMessageRepositoryInterface,
    private readonly processKindBetUseCase: ProcessKindBetUseCase,
    private readonly processKindWinUseCase: ProcessKindWinUseCase,
    private readonly processKindLossUseCase: ProcessKindLossUseCase,
    private readonly processKindRefoundUseCase: ProcessKindRefoundUseCase,
    private readonly processKindRollbackUseCase: ProcessKindRollbackUseCase,
  ) {}

  async execute(props: ProcessOperationProps): Promise<ProcessOperationResult> {
    const payloadHash = this.createPayloadHash(props);

    try {
      return await this.uow.execute(async (manager: EntityManager) => {
        const wagerTransactionRepository =
          this.wagerTransactionRepository.withTransaction(manager);
        const existing = await wagerTransactionRepository.findByIdempotencyKey(
          props.idempotencyKey,
        );

        if (existing) {
          return this.toReplayResult(existing, payloadHash);
        }

        const wagerTransaction = WagerTransactionFactory.create({
          providerId: props.providerId,
          externalTransactionId: props.externalTransactionId,
          idempotencyKey: props.idempotencyKey,
          payloadHash,
          walletId: props.walletId,
          playerId: props.playerId,
          roundId: props.roundId,
          gameId: props.gameId,
          kind: props.kind,
          referenceExternalTransactionId: props.referenceExternalTransactionId,
          money: props.money,
          status: WagerTransactionStatus.Pending,
        });
        await wagerTransactionRepository.create(wagerTransaction);

        const result = await this.dispatch(props, manager, wagerTransaction);
        await this.recordInbox(manager, props, payloadHash);
        return result;
      });
    } catch (error) {
      if (!(error instanceof IdempotencyKeyAlreadyExistsError)) {
        throw error;
      }

      const existing =
        await this.wagerTransactionRepository.findByIdempotencyKey(
          props.idempotencyKey,
        );
      if (!existing) {
        throw error;
      }
      return this.toReplayResult(existing, payloadHash);
    }
  }

  private async dispatch(
    props: ProcessOperationProps,
    manager: EntityManager,
    transaction: WagerTransaction,
  ): Promise<ProcessOperationResult> {
    switch (transaction.kind) {
      case WagerTransactionKind.Bet:
        return this.processKindBetUseCase.execute(props, manager, transaction);
      case WagerTransactionKind.Win:
        return this.processKindWinUseCase.execute(props, manager, transaction);
      case WagerTransactionKind.Loss:
        return this.processKindLossUseCase.execute(props, manager, transaction);
      case WagerTransactionKind.Refund:
        return this.processKindRefoundUseCase.execute(
          props,
          manager,
          transaction,
        );
      case WagerTransactionKind.Rollback:
        return this.processKindRollbackUseCase.execute(
          props,
          manager,
          transaction,
        );
      default:
        throw new Error(`Unsupported transaction kind: ${transaction.kind}`);
    }
  }

  private toReplayResult(
    existing: WagerTransaction,
    payloadHash: string,
  ): ProcessOperationResult {
    if (existing.payloadHash !== payloadHash) {
      throw new IdempotencyConflictError(
        'A Idempotency-Key já foi usada com outro payload',
      );
    }

    if (
      !existing.resultBalance &&
      existing.status !== WagerTransactionStatus.PendingReference &&
      existing.status !== WagerTransactionStatus.Rejected
    ) {
      throw new Error(
        `A transação ${existing.id} não tem o saldo do resultado salvo`,
      );
    }

    return {
      transactionId: existing.id,
      status: existing.status,
      balance: existing.resultBalance,
      idempotentReplay: true,
    };
  }

  private createPayloadHash(props: ProcessOperationProps): string {
    const canonicalPayload = {
      externalTransactionId: props.externalTransactionId,
      gameId: props.gameId,
      kind: props.kind,
      referenceExternalTransactionId:
        props.referenceExternalTransactionId ?? null,
      money: {
        amount: props.money.amount,
        currency: props.money.currency,
      },
      playerId: props.playerId,
      providerId: props.providerId,
      roundId: props.roundId,
      walletId: props.walletId,
    };

    return createHash('sha256')
      .update(JSON.stringify(canonicalPayload), 'utf8')
      .digest('hex');
  }

  private async recordInbox(
    manager: EntityManager,
    props: ProcessOperationProps,
    payloadHash: string,
  ): Promise<void> {
    if (isUndefined(props.inbox)) {
      return;
    }

    await this.inboxMessageRepository.withTransaction(manager).create(
      InboxMessageFactory.create({
        consumerName: props.inbox.consumerName,
        messageId: props.inbox.messageId,
        payloadHash,
        receivedAt: new Date(),
        processedAt: new Date(),
      }),
    );
  }
}
