export default class BalanceError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'BalanceError';
  }
}
