import { AggregateRoot } from '../@shared/aggregate-root';
import Money from '../@shared/value-objects/money.vo';
import UniqueEntityId from '../@shared/value-objects/unique-entity-id.vo';
import BalanceError from '../@shared/errors/balance.error';
import Decimal from 'decimal.js';

export type WalletProps = {
  id: string;
  playerId: string;
  currency: string;
  balance: {
    amount: string;
    currency: string;
  };
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export default class WalletAggregate extends AggregateRoot<WalletProps> {
  public readonly playerId: string;
  public readonly currency: string;
  private _balance: Money;
  private _version: number;
  private _updatedAt: Date;

  constructor(
    protected props: WalletProps,
    id?: string,
  ) {
    super(props, new UniqueEntityId(id));
    this.playerId = props.playerId;
    this.currency = props.currency;
    this._balance = new Money({
      amount: new Decimal(props.balance.amount),
      currency: props.balance.currency,
    });
    this._version = props.version;
    this._updatedAt = props.updatedAt;
  }

  validate(): void {}

  get balance(): Money {
    return this._balance;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  debit(money: Money): void {
    this.assertSameCurrency(money);
    const newAmount = this._balance.value.amount.minus(money.value.amount);
    if (newAmount.isNegative()) {
      throw new BalanceError('Insufficient balance');
    }
    this.financialOperations(newAmount);
  }

  credit(money: Money): void {
    this.assertSameCurrency(money);
    if (money.value.amount.isNegative()) {
      throw new BalanceError('Cannot credit a negative amount');
    }
    const newAmount = this._balance.value.amount.plus(money.value.amount);
    this.financialOperations(newAmount);
  }

  private financialOperations(newAmount: Decimal) {
    this._version += 1;
    this._updatedAt = new Date();
    this._balance = new Money({
      amount: newAmount,
      currency: this._balance.value.currency,
    });
  }

  private assertSameCurrency(money: Money): void {
    this._balance.assertSameCurrency(money);
  }
}
