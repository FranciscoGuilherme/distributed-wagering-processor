import Decimal from 'decimal.js';
import { ValueObject } from './value-object';
import MoneyCurrencyError from '../errors/money-currency.error';

interface MoneyProps {
  amount: Decimal;
  currency: string;
}

export default class Money extends ValueObject<MoneyProps> {
  constructor(props: MoneyProps) {
    super(props);
    this.validate();
  }

  validate(): void {
    if (this.value.amount.isNaN()) {
      throw new Error('Amount must be a valid decimal number');
    }
    if (this.value.amount.isNegative()) {
      throw new Error('Amount cannot be negative');
    }
    if (!this.value.currency || this.value.currency.length !== 3) {
      throw new Error('Currency must be a valid ISO-4217 code');
    }
  }

  assertSameCurrency(other: Money): void {
    if (this.value.currency !== other.value.currency) {
      throw new MoneyCurrencyError(
        'Cannot operate on Money values with different currencies',
      );
    }
  }
}
