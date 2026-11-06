import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { SYSTEM_MESSAGES } from '../../../shared/constants/system-messages';
import UniqueEntityIdError from '../errors/unique-entity-id.error';
import { ValueObject } from './value-object';

export default class UniqueEntityId extends ValueObject<string> {
  constructor(readonly id?: string) {
    super(id || uuidv4());
    this.validate();
  }

  private validate(): void {
    const isValid: boolean = uuidValidate(this._data);
    if (!isValid) {
      throw new UniqueEntityIdError(SYSTEM_MESSAGES.DOMAIN.INVALID_ENTITY_ID);
    }
  }
}
