import Decimal from 'decimal.js';
import { SYSTEM_MESSAGES } from '../../../shared/constants/system-messages';
import MoneyCurrencyError from '../errors/money-currency.error';
import { ValueObject } from './value-object';

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
      throw new Error(SYSTEM_MESSAGES.DOMAIN.INVALID_DECIMAL_AMOUNT);
    }
    if (this.value.amount.isNegative()) {
      throw new Error(SYSTEM_MESSAGES.DOMAIN.NEGATIVE_AMOUNT);
    }
    if (!this.value.currency || this.value.currency.length !== 3) {
      throw new Error(SYSTEM_MESSAGES.DOMAIN.INVALID_CURRENCY);
    }
  }

  assertSameCurrency(other: Money): void {
    if (this.value.currency !== other.value.currency) {
      throw new MoneyCurrencyError(SYSTEM_MESSAGES.DOMAIN.CURRENCY_MISMATCH);
    }
  }
}
