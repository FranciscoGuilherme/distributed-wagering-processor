import type { TransactionScope } from './transaction-scope.interface';

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface UnitOfWork {
  execute<T>(operation: (scope: TransactionScope) => Promise<T>): Promise<T>;
}
