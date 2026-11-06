import { createHash } from 'crypto';
import Decimal from 'decimal.js';
import type { FailureCode } from '../../domain/@shared/constants/failure-codes';
import IdempotencyConflictError from '../../domain/@shared/errors/idempotency-conflict.error';
import IdempotencyKeyAlreadyExistsError from '../../domain/@shared/errors/idempotency-key-already-exists.error';
import InboxMessageAlreadyExistsError from '../../domain/@shared/errors/inbox-message-already-exists.error';
import InboxMessageConflictError from '../../domain/@shared/errors/inbox-message-conflict.error';
import WagerTransaction, {
  WagerTransactionKind,
  WagerTransactionStatus,
  type WagerTransactionBalance,
} from '../../domain/entities/wager-transaction.entity';
import InboxMessageFactory from '../../domain/factories/inbox-message.factory';
import WagerTransactionFactory from '../../domain/factories/wager-transaction.factory';
import type InboxMessageRepositoryInterface from '../../domain/repositories/inbox-message-repository.interface';
import { SYSTEM_MESSAGES } from '../../shared/constants/system-messages';
import type { TransactionScope } from '../ports/transaction-scope.interface';
import type { UnitOfWork } from '../ports/unit-of-work.interface';
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
  failureCode?: FailureCode;
};

export type ProcessOperationOutcome =
  ProcessOperationResult | { duplicateMessage: true; idempotentReplay: true };

export default class ProcessOperationUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly inboxMessageRepository: InboxMessageRepositoryInterface,
    private readonly processKindBetUseCase: ProcessKindBetUseCase,
    private readonly processKindWinUseCase: ProcessKindWinUseCase,
    private readonly processKindLossUseCase: ProcessKindLossUseCase,
    private readonly processKindRefoundUseCase: ProcessKindRefoundUseCase,
    private readonly processKindRollbackUseCase: ProcessKindRollbackUseCase,
  ) {}

  async execute(
    props: ProcessOperationProps,
  ): Promise<ProcessOperationOutcome> {
    const payloadHash = this.createPayloadHash(props);

    try {
      return await this.uow.execute(async (scope: TransactionScope) => {
        const wagerTransactionRepository = scope.wagerTransactionRepository;
        const inboxRepository = scope.inboxMessageRepository;

        const existingInbox = props.inbox
          ? await inboxRepository.findByConsumerAndMessageId(
              props.inbox.consumerName,
              props.inbox.messageId,
            )
          : null;

        if (existingInbox) {
          this.assertInboxPayload(existingInbox.payloadHash, payloadHash);
          return { duplicateMessage: true, idempotentReplay: true };
        }

        const existing = await wagerTransactionRepository.findByIdempotencyKey(
          props.idempotencyKey,
        );

        if (existing) {
          const result = this.toReplayResult(existing, payloadHash);
          await this.recordInbox(scope, props, payloadHash);
          return result;
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

        const result = await this.dispatch(props, scope, wagerTransaction);
        await this.recordInbox(scope, props, payloadHash);
        return result;
      });
    } catch (error) {
      if (error instanceof IdempotencyKeyAlreadyExistsError) {
        return this.recoverIdempotencyRace(props, payloadHash);
      }

      if (error instanceof InboxMessageAlreadyExistsError) {
        return this.recoverInboxRace(props, payloadHash);
      }

      throw error;
    }
  }

  private async recoverIdempotencyRace(
    props: ProcessOperationProps,
    payloadHash: string,
  ): Promise<ProcessOperationOutcome> {
    try {
      return await this.uow.execute(async (scope: TransactionScope) => {
        const inboxRepository = scope.inboxMessageRepository;
        const existingInbox = props.inbox
          ? await inboxRepository.findByConsumerAndMessageId(
              props.inbox.consumerName,
              props.inbox.messageId,
            )
          : null;
        if (existingInbox) {
          this.assertInboxPayload(existingInbox.payloadHash, payloadHash);
          return { duplicateMessage: true, idempotentReplay: true };
        }

        const existing =
          await scope.wagerTransactionRepository.findByIdempotencyKey(
            props.idempotencyKey,
          );
        if (!existing) {
          throw new IdempotencyKeyAlreadyExistsError(
            SYSTEM_MESSAGES.PERSISTENCE.CONCURRENT_TRANSACTION_NOT_FOUND,
          );
        }

        const result = this.toReplayResult(existing, payloadHash);
        await this.recordInbox(scope, props, payloadHash);
        return result;
      });
    } catch (error) {
      if (error instanceof InboxMessageAlreadyExistsError) {
        return this.recoverInboxRace(props, payloadHash);
      }
      throw error;
    }
  }

  private async recoverInboxRace(
    props: ProcessOperationProps,
    payloadHash: string,
  ): Promise<ProcessOperationOutcome> {
    if (!props.inbox) {
      throw new InboxMessageAlreadyExistsError(
        SYSTEM_MESSAGES.PERSISTENCE.INBOX_METADATA_MISSING,
      );
    }

    const existing =
      await this.inboxMessageRepository.findByConsumerAndMessageId(
        props.inbox.consumerName,
        props.inbox.messageId,
      );
    if (!existing) {
      throw new InboxMessageAlreadyExistsError(
        SYSTEM_MESSAGES.PERSISTENCE.CONFLICTING_INBOX_NOT_FOUND,
      );
    }
    this.assertInboxPayload(existing.payloadHash, payloadHash);
    return { duplicateMessage: true, idempotentReplay: true };
  }

  private assertInboxPayload(
    existingPayloadHash: string,
    payloadHash: string,
  ): void {
    if (existingPayloadHash !== payloadHash) {
      throw new InboxMessageConflictError(
        SYSTEM_MESSAGES.PERSISTENCE.INBOX_PAYLOAD_CONFLICT,
      );
    }
  }

  private async dispatch(
    props: ProcessOperationProps,
    scope: TransactionScope,
    transaction: WagerTransaction,
  ): Promise<ProcessOperationResult> {
    switch (transaction.kind) {
      case WagerTransactionKind.Bet:
        return this.processKindBetUseCase.execute(props, scope, transaction);
      case WagerTransactionKind.Win:
        return this.processKindWinUseCase.execute(props, scope, transaction);
      case WagerTransactionKind.Loss:
        return this.processKindLossUseCase.execute(props, scope, transaction);
      case WagerTransactionKind.Refund:
        return this.processKindRefoundUseCase.execute(
          props,
          scope,
          transaction,
        );
      case WagerTransactionKind.Rollback:
        return this.processKindRollbackUseCase.execute(
          props,
          scope,
          transaction,
        );
      default:
        throw new Error(
          SYSTEM_MESSAGES.APPLICATION.UNSUPPORTED_TRANSACTION_KIND,
        );
    }
  }

  private toReplayResult(
    existing: WagerTransaction,
    payloadHash: string,
  ): ProcessOperationResult {
    if (existing.payloadHash !== payloadHash) {
      throw new IdempotencyConflictError(
        SYSTEM_MESSAGES.HTTP.IDEMPOTENCY_CONFLICT,
      );
    }

    if (
      !existing.resultBalance &&
      existing.status !== WagerTransactionStatus.PendingReference &&
      existing.status !== WagerTransactionStatus.Rejected
    ) {
      throw new Error(
        SYSTEM_MESSAGES.APPLICATION.STORED_RESULT_BALANCE_MISSING,
      );
    }

    return {
      transactionId: existing.id,
      status: existing.status,
      balance: existing.resultBalance,
      idempotentReplay: true,
      failureCode: existing.failureCode,
    };
  }

  private createPayloadHash(props: ProcessOperationProps): string {
    const canonicalPayload = {
      externalTransactionId: props.externalTransactionId,
      gameId: props.gameId,
      kind: props.kind,
      money: {
        amount: new Decimal(props.money.amount).toFixed(2),
        currency: props.money.currency,
      },
      playerId: props.playerId,
      providerId: props.providerId,
      referenceExternalTransactionId:
        props.referenceExternalTransactionId ?? null,
      roundId: props.roundId,
      walletId: props.walletId,
    };

    return createHash('sha256')
      .update(JSON.stringify(canonicalPayload), 'utf8')
      .digest('hex');
  }

  private async recordInbox(
    scope: TransactionScope,
    props: ProcessOperationProps,
    payloadHash: string,
  ): Promise<void> {
    if (!props.inbox) {
      return;
    }

    await scope.inboxMessageRepository.create(
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
