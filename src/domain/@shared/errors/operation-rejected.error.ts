import type { FailureCode } from '../constants/failure-codes';

export default class OperationRejectedError extends Error {
  constructor(
    message?: string,
    public readonly failureCode?: FailureCode,
  ) {
    super(message);
    this.name = 'OperationRejectedError';
  }
}
