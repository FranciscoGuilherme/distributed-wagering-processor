import type { FailureCode } from '../../entities/wager-transaction.entity';

export default class OperationRejectedError extends Error {
  constructor(
    message?: string,
    public readonly failureCode?: FailureCode,
  ) {
    super(message);
    this.name = 'OperationRejectedError';
  }
}
