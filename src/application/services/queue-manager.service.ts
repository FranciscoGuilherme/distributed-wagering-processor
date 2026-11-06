import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import InvalidQueueMessageError from '../../domain/@shared/errors/invalid-queue-message.error';
import { WagerOperationDto } from '../dtos/wager-operation.dto';
import ProcessOperationUseCase from '../usecases/process-operation.usecase';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export default class QueueManagerService {
  constructor(private readonly processOperation: ProcessOperationUseCase) {}

  async processQueueMessage(envelope: unknown): Promise<void> {
    if (
      !isRecord(envelope) ||
      envelope.type !== 'WagerTransactionRequested' ||
      typeof envelope.messageId !== 'string' ||
      !envelope.messageId.trim() ||
      typeof envelope.consumerName !== 'string' ||
      !envelope.consumerName.trim() ||
      typeof envelope.occurredAt !== 'string' ||
      Number.isNaN(Date.parse(envelope.occurredAt)) ||
      !isRecord(envelope.data)
    ) {
      throw new InvalidQueueMessageError('Invalid wager queue envelope');
    }

    const { idempotencyKey, ...businessData } = envelope.data;
    if (
      typeof idempotencyKey !== 'string' ||
      !idempotencyKey.trim() ||
      idempotencyKey !== idempotencyKey.trim() ||
      idempotencyKey.length > 200
    ) {
      throw new InvalidQueueMessageError(
        'Queue operation requires a valid idempotencyKey',
      );
    }

    const operation = plainToInstance(WagerOperationDto, businessData);
    const validationErrors = validateSync(operation, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });
    if (validationErrors.length > 0) {
      throw new InvalidQueueMessageError('Invalid wager operation payload');
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
        consumerName: envelope.consumerName,
        messageId: envelope.messageId,
      },
    });
  }
}
