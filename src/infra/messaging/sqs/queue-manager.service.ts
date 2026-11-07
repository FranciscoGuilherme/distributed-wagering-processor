import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import ProcessOperationUseCase from '../../../application/usecases/process-operation.usecase';
import InvalidQueueMessageError from '../../../domain/@shared/errors/invalid-queue-message.error';
import { isRecord } from '../../../helpers/validations';
import { SYSTEM_MESSAGES } from '../../../shared/constants/system-messages';
import { WagerTransactionEnvelopeDto } from '../../dto/envelop.dto';
import { WAGER_TRANSACTION_CONSUMER_NAME } from './sqs.constants';

export default class QueueManagerService {
  constructor(private readonly processOperation: ProcessOperationUseCase) {}

  async processQueueMessage(requestData: unknown): Promise<void> {
    const envelope = this.getEnvelopRequest(requestData);
    const validationErrors = validateSync(envelope.data, {
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
      idempotencyKey: envelope.data.idempotencyKey,
      providerId: envelope.data.providerId,
      externalTransactionId: envelope.data.externalTransactionId,
      playerId: envelope.data.playerId,
      walletId: envelope.data.walletId,
      roundId: envelope.data.roundId,
      gameId: envelope.data.gameId,
      kind: envelope.data.kind,
      money: {
        amount: envelope.data.money.amount,
        currency: envelope.data.money.currency,
      },
      referenceExternalTransactionId:
        envelope.data.referenceExternalTransactionId,
      inbox: {
        consumerName: WAGER_TRANSACTION_CONSUMER_NAME,
        messageId: envelope.messageId,
      },
    });
  }

  private getEnvelopRequest(envelope: unknown): WagerTransactionEnvelopeDto {
    if (!isRecord(envelope)) {
      throw new InvalidQueueMessageError(
        SYSTEM_MESSAGES.VALIDATION.INVALID_QUEUE_ENVELOPE,
      );
    }

    const dto = plainToInstance(WagerTransactionEnvelopeDto, envelope);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      throw new InvalidQueueMessageError(
        SYSTEM_MESSAGES.VALIDATION.INVALID_QUEUE_ENVELOPE,
      );
    }

    return dto;
  }
}
