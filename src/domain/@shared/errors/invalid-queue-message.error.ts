export default class InvalidQueueMessageError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'InvalidQueueMessageError';
  }
}
