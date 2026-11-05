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
  direction: LedgerDirection;
  money: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  createdAt: Date;
};

export default class WalletLedgerEntry extends Entity<WalletLedgerEntryProps> {
  public readonly walletId!: string;
  public readonly transactionId!: string;
  public readonly direction!: LedgerDirection;
  public readonly money!: Money;
  public readonly balanceBefore!: Money;
  public readonly balanceAfter!: Money;
  public readonly createdAt!: Date;

  constructor(props: WalletLedgerEntryProps, id?: string) {
    super(props, new UniqueEntityId(id));
    Object.assign(this, props);
    this.validate();
  }

  validate(): void {}

  isBalanced(): boolean {
    return this.balanceBefore.value.amount
      .add(this.money.value.amount)
      .equals(this.balanceAfter.value.amount);
  }
}
