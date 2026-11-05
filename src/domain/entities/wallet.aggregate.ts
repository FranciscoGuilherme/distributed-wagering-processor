import { AggregateRoot } from '../@shared/aggregate-root';
import Money from '../@shared/value-objects/money.vo';
import UniqueEntityId from '../@shared/value-objects/unique-entity-id.vo';
import BalanceError from '../@shared/errors/balance.error';

export type WalletProps = {
  id: string;
  playerId: string;
  currency: string;
  balance: Money;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export default class WalletAggregate extends AggregateRoot<WalletProps> {
  public readonly playerId!: string;
  public readonly currency!: string;
  private _balance!: Money;
  private _version!: number;
  private _updatedAt!: Date;

  constructor(
    protected props: WalletProps,
    id?: string,
  ) {
    super(props, new UniqueEntityId(id));
    Object.assign(this, props);
    this.validate();
  }

  get balance(): Money {
    return this._balance;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  validate(): void {}

  debit(amount: Money): void {
    this.assertSameCurrency(amount);
    const newBalance = this._balance.value.amount.minus(amount.value.amount);
    if (newBalance.isNegative()) {
      throw new BalanceError('Insufficient balance');
    }
    this._version += 1;
    this._balance = new Money({
      amount: newBalance,
      currency: this._balance.value.currency,
    });
  }

  credit(amount: Money): void {
    this.assertSameCurrency(amount);
    if (amount.value.amount.isNegative()) {
      throw new BalanceError('Cannot credit a negative amount');
    }
    const newBalance = this._balance.value.amount.plus(amount.value.amount);
    this._version += 1;
    this._balance = new Money({
      amount: newBalance,
      currency: this._balance.value.currency,
    });
  }

  private assertSameCurrency(money: Money): void {
    this._balance.assertSameCurrency(money);
  }
}

// TODO: Deve ser reconstruída a partir da persistência por uma factory rehydrate(), sem reexecutar as regras de transição.
