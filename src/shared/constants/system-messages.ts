export const SYSTEM_MESSAGES = {
  DOMAIN: {
    INVALID_DECIMAL_AMOUNT: 'Amount must be a valid decimal number',
    NEGATIVE_AMOUNT: 'Amount cannot be negative',
    INVALID_CURRENCY: 'Currency must be a valid ISO-4217 code',
    CURRENCY_MISMATCH:
      'Cannot operate on money values with different currencies',
    INSUFFICIENT_BALANCE: 'Insufficient balance',
    NEGATIVE_CREDIT: 'Cannot credit a negative amount',
    INVALID_ENTITY_ID: 'Invalid entity ID',
    TERMINAL_TRANSACTION_TRANSITION: 'Cannot transition a terminal transaction',
  },
  APPLICATION: {
    WALLET_NOT_FOUND: 'Wallet not found',
    WALLET_CONTEXT_MISMATCH:
      'The wallet owner or currency does not match the operation',
    REFERENCE_TRANSACTION_ID_REQUIRED:
      'A reference external transaction ID is required',
    REFERENCE_ALREADY_ROLLED_BACK:
      'The referenced transaction has already been rolled back',
    REFERENCE_NOT_PROCESSED: 'The referenced transaction must be processed',
    REFERENCE_KIND_NOT_ROLLBACKABLE:
      'The referenced transaction kind cannot be rolled back',
    REFERENCE_CONTEXT_MISMATCH:
      'The reference does not belong to the same operation context',
    ROLLBACK_AMOUNT_MISMATCH:
      'The rollback must match the referenced transaction currency and amount',
    ROLLBACK_WALLET_CONTEXT_MISMATCH:
      'The wallet owner or currency does not match the rollback',
    REFUND_BET_NOT_ALLOWED: 'Only a processed BET can be refunded',
    REFUND_REFERENCE_MISMATCH:
      'The refund must match the referenced BET context and amount',
    REFUND_WALLET_CONTEXT_MISMATCH:
      'The wallet owner or currency does not match the refund',
    REFUND_ALREADY_APPLIED: 'The referenced BET has already been refunded',
    UNSUPPORTED_TRANSACTION_KIND: 'Unsupported transaction kind',
    STORED_RESULT_BALANCE_MISSING:
      'The transaction has no stored result balance',
  },
  VALIDATION: {
    INVALID_REQUEST: 'The request payload is invalid',
    INVALID_QUEUE_ENVELOPE: 'Invalid wager queue envelope',
    INVALID_QUEUE_IDEMPOTENCY_KEY:
      'The queue operation requires a valid idempotency key',
    INVALID_QUEUE_OPERATION_PAYLOAD: 'Invalid wager operation payload',
  },
  HTTP: {
    HELLO_WORLD: 'Hello World!',
    IDEMPOTENCY_KEY_REQUIRED:
      'The Idempotency-Key header is required and must be at most 200 characters',
    IDEMPOTENCY_CONFLICT:
      'The Idempotency-Key was already used with a different payload',
    PERSISTENCE_UNAVAILABLE:
      'A transient persistence failure occurred; please retry',
    INTERNAL_ERROR: 'An internal error occurred',
  },
  SQS: {
    OPERATION_QUEUE_URL_REQUIRED:
      'SQS_OPERATION_QUEUE_URL is required when the SQS consumer is enabled',
    OUTBOX_QUEUE_URL_REQUIRED:
      'SQS_OUTBOX_QUEUE_URL is required when the outbox publisher is enabled',
    INVALID_INTEGER_CONFIGURATION:
      'An SQS configuration value is outside its permitted integer range',
    RECEIVE_FAILED: 'SQS receive failed; polling will resume',
    MESSAGE_MISSING_BODY_OR_RECEIPT:
      'SQS returned a message without a body or receipt handle',
    MESSAGE_BODY_NOT_JSON: 'Queue message body is not valid JSON',
    MESSAGE_NOT_ACKNOWLEDGED:
      'SQS message was not acknowledged; it will be retried',
    DEFER_RETRY_FAILED: 'Could not defer the SQS message for retry',
  },
  OUTBOX: {
    INVALID_INTEGER_CONFIGURATION:
      'An outbox configuration value is outside its permitted integer range',
    RETRY_SCHEDULING_FAILED: 'Could not schedule an outbox retry',
    EVENT_REMAINS_PENDING: 'An outbox event remains pending',
    POLLING_FAILED: 'Outbox polling failed; the lease will permit recovery',
  },
  PERSISTENCE: {
    IDEMPOTENCY_KEY_ALREADY_EXISTS:
      'A transaction with this idempotency key already exists',
    INBOX_MESSAGE_ALREADY_EXISTS:
      'An inbox message with this consumer and message ID already exists',
    WALLET_ALREADY_EXISTS:
      'A wallet for this player and currency already exists',
    CONCURRENT_TRANSACTION_NOT_FOUND:
      'The concurrent transaction could not be found',
    INBOX_METADATA_MISSING:
      'An inbox uniqueness violation occurred without inbox metadata',
    CONFLICTING_INBOX_NOT_FOUND:
      'The conflicting inbox row could not be found after rollback',
    INBOX_PAYLOAD_CONFLICT:
      'The message was previously received with different business content',
  },
} as const;
