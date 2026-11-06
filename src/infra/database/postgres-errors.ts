import { QueryFailedError } from 'typeorm';

export const POSTGRES_CONSTRAINTS = {
  WAGER_TRANSACTION_IDEMPOTENCY_KEY: 'uq_wager_transactions_idempotency_key',
  INBOX_CONSUMER_MESSAGE: 'uq_inbox_messages_consumer_message',
  WALLET_PLAYER_CURRENCY: 'uq_wallets_player_currency',
} as const;

export function isPostgresUniqueConstraintViolation(
  error: unknown,
  constraintName: string,
): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError: unknown = error.driverError;
  if (typeof driverError !== 'object' || driverError === null) {
    return false;
  }
  const postgresError = driverError as {
    code?: unknown;
    constraint?: unknown;
  };

  return (
    postgresError.code === '23505' &&
    postgresError.constraint === constraintName
  );
}
