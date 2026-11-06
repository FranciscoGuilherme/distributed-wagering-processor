import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { WagerOperationDto } from '../../application/dtos/wager-operation.dto';
import ProcessOperationUseCase from '../../application/usecases/process-operation.usecase';
import { WagerTransactionStatus } from '../../domain/entities/wager-transaction.entity';

@Controller('wagering/transactions')
export class WageringController {
  constructor(private readonly processOperation: ProcessOperationUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: WagerOperationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (
      !idempotencyKey?.trim() ||
      idempotencyKey !== idempotencyKey.trim() ||
      idempotencyKey.length > 200
    ) {
      response.status(HttpStatus.BAD_REQUEST);
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'INVALID_IDEMPOTENCY_KEY',
        message:
          'O header Idempotency-Key é obrigatório e deve ter até 200 caracteres',
      };
    }

    const result = await this.processOperation.execute({
      idempotencyKey,
      providerId: body.providerId,
      externalTransactionId: body.externalTransactionId,
      playerId: body.playerId,
      walletId: body.walletId,
      roundId: body.roundId,
      gameId: body.gameId,
      kind: body.kind,
      money: {
        amount: body.money.amount,
        currency: body.money.currency,
      },
      referenceExternalTransactionId: body.referenceExternalTransactionId,
    });

    if ('duplicateMessage' in result) return result;
    if (result.status === WagerTransactionStatus.PendingReference) {
      response.status(HttpStatus.ACCEPTED);
    }
    if (result.status === WagerTransactionStatus.Rejected) {
      response.status(HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return result;
  }
}
