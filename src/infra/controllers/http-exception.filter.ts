import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import IdempotencyConflictError from '../../domain/@shared/errors/idempotency-conflict.error';
import WalletAlreadyExistsError from '../../domain/@shared/errors/wallet-already-exists.error';
import { SYSTEM_MESSAGES } from '../../shared/constants/system-messages';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof IdempotencyConflictError) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        code: 'IDEMPOTENCY_CONFLICT',
        message: SYSTEM_MESSAGES.HTTP.IDEMPOTENCY_CONFLICT,
      });
      return;
    }

    if (exception instanceof WalletAlreadyExistsError) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        code: 'WALLET_ALREADY_EXISTS',
        message: SYSTEM_MESSAGES.PERSISTENCE.WALLET_ALREADY_EXISTS,
      });
      return;
    }

    const errorCode =
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof exception.code === 'string'
        ? exception.code
        : undefined;
    if (
      exception instanceof QueryFailedError ||
      ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(errorCode ?? '')
    ) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'PERSISTENCE_UNAVAILABLE',
        message: SYSTEM_MESSAGES.HTTP.PERSISTENCE_UNAVAILABLE,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: SYSTEM_MESSAGES.HTTP.INTERNAL_ERROR,
    });
  }
}
