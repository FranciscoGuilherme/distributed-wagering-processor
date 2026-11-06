export default class IdempotencyKeyAlreadyExistsError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'IdempotencyKeyAlreadyExistsError';
  }
}
