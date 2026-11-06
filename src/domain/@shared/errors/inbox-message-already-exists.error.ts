export default class InboxMessageAlreadyExistsError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'InboxMessageAlreadyExistsError';
  }
}
