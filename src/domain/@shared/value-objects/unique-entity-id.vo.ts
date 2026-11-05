import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { ValueObject } from './value-object';
import UniqueEntityIdError from '../errors/unique-entity-id.error';

export default class UniqueEntityId extends ValueObject<string> {
  constructor(readonly id?: string) {
    super(id || uuidv4());
    this.validate();
  }

  private validate(): void {
    const isValid: boolean = uuidValidate(this._data);
    if (!isValid) {
      throw new UniqueEntityIdError(`Invalid UUID: ${this._data}`);
    }
  }
}
