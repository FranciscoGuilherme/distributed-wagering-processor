export default class RefoundNotAllowedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'RefoundNotAllowedError';
  }
}
