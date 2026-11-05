import Decimal from 'decimal.js';
import Entity from '../@shared/entity';
import Money from '../@shared/value-objects/money.vo';
import UniqueEntityId from '../@shared/value-objects/unique-entity-id.vo';

enum LedgerDirection {
  Debit = 'DEBIT',
  Credit = 'CREDIT',
}

export type WalletLedgerEntryProps = {
  walletId: string;
  transactionId: string;
  direction: string;
  money: {
    amount: string;
    currency: string;
  };
  balanceBefore: {
    amount: string;
    currency: string;
  };
  balanceAfter: {
    amount: string;
    currency: string;
  };
  createdAt: Date;
};

export default class WalletLedgerEntry extends Entity<WalletLedgerEntryProps> {
  public readonly walletId: string;
  public readonly transactionId: string;
  public readonly direction: LedgerDirection;
  public readonly money: Money;
  public readonly balanceBefore: Money;
  public readonly balanceAfter: Money;
  public readonly createdAt: Date;

  constructor(props: WalletLedgerEntryProps, id?: string) {
    super(props, new UniqueEntityId(id));
    this.walletId = props.walletId;
    this.transactionId = props.transactionId;
    this.direction = props.direction as LedgerDirection;
    this.money = new Money({
      amount: new Decimal(props.money.amount),
      currency: props.money.currency,
    });
    this.balanceBefore = new Money({
      amount: new Decimal(props.balanceBefore.amount),
      currency: props.balanceBefore.currency,
    });
    this.balanceAfter = new Money({
      amount: new Decimal(props.balanceAfter.amount),
      currency: props.balanceAfter.currency,
    });
    this.createdAt = props.createdAt;
  }

  validate(): void {}

  isBalanced(): boolean {
    this.balanceBefore.assertSameCurrency(this.money);
    if (this.direction === LedgerDirection.Credit) {
      return this.balanceBefore.value.amount
        .add(this.money.value.amount)
        .equals(this.balanceAfter.value.amount);
    }

    return this.balanceBefore.value.amount
      .minus(this.money.value.amount)
      .equals(this.balanceAfter.value.amount);
  }
}
