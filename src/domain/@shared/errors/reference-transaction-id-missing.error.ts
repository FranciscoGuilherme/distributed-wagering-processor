export default class ReferenceTransactionIdMissing extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ReferenceTransactionIdMissing';
  }
}
