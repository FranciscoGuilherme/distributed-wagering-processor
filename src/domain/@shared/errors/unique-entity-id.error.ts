export default class UniqueEntityIdError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "UniqueEntityIdError";
  }
}
