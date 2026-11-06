import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { WagerOperationDto } from '../../../application/dtos/wager-operation.dto';
import ProcessOperationUseCase from '../../../application/usecases/process-operation.usecase';
import InvalidQueueMessageError from '../../../domain/@shared/errors/invalid-queue-message.error';
import { SYSTEM_MESSAGES } from '../../../shared/constants/system-messages';
import { WAGER_TRANSACTION_CONSUMER_NAME } from './sqs.constants';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default class QueueManagerService {
  constructor(private readonly processOperation: ProcessOperationUseCase) {}

  async processQueueMessage(envelope: unknown): Promise<void> {
    if (
      !isRecord(envelope) ||
      envelope.type !== 'WagerTransactionRequested' ||
      typeof envelope.messageId !== 'string' ||
      !envelope.messageId.trim() ||
      typeof envelope.occurredAt !== 'string' ||
      Number.isNaN(Date.parse(envelope.occurredAt)) ||
      !isRecord(envelope.data)
    ) {
      throw new InvalidQueueMessageError(
        SYSTEM_MESSAGES.VALIDATION.INVALID_QUEUE_ENVELOPE,
      );
    }

    const { idempotencyKey, ...businessData } = envelope.data;
    if (
      typeof idempotencyKey !== 'string' ||
      !idempotencyKey.trim() ||
      idempotencyKey !== idempotencyKey.trim() ||
      idempotencyKey.length > 200
    ) {
      throw new InvalidQueueMessageError(
        SYSTEM_MESSAGES.VALIDATION.INVALID_QUEUE_IDEMPOTENCY_KEY,
      );
    }

    const operation = plainToInstance(WagerOperationDto, businessData);
    const validationErrors = validateSync(operation, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });
    if (validationErrors.length > 0) {
      throw new InvalidQueueMessageError(
        SYSTEM_MESSAGES.VALIDATION.INVALID_QUEUE_OPERATION_PAYLOAD,
      );
    }

    await this.processOperation.execute({
      idempotencyKey,
      providerId: operation.providerId,
      externalTransactionId: operation.externalTransactionId,
      playerId: operation.playerId,
      walletId: operation.walletId,
      roundId: operation.roundId,
      gameId: operation.gameId,
      kind: operation.kind,
      money: {
        amount: operation.money.amount,
        currency: operation.money.currency,
      },
      referenceExternalTransactionId: operation.referenceExternalTransactionId,
      inbox: {
        consumerName: WAGER_TRANSACTION_CONSUMER_NAME,
        messageId: envelope.messageId,
      },
    });
  }
}
