export default class InboxMessageConflictError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'InboxMessageConflictError';
  }
}
