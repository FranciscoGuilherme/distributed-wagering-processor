export default class MoneyCurrencyError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'MoneyCurrencyError';
  }
}
