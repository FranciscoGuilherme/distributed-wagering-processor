import isEqual from 'lodash/isEqual';
import { deepFreeze } from '../utils/object';

export abstract class ValueObject<Data = any> {
  protected readonly _data: Data;

  constructor(data: Data) {
    this._data = deepFreeze(data);
  }

  get value(): Data {
    return this._data;
  }

  public equals(obj: this): boolean {
    if (obj === null || obj === undefined) {
      return false;
    }

    if (obj.value === undefined) {
      return false;
    }

    if (obj.constructor.name !== this.constructor.name) {
      return false;
    }

    return isEqual(this.value, obj.value);
  }
}
