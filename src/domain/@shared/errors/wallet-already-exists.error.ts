export default class WalletAlreadyExistsError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'WalletAlreadyExistsError';
  }
}
