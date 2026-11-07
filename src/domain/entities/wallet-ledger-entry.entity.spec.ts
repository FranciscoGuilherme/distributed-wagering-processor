import WalletLedgerEntry, {
  LedgerDirection,
} from './wallet-ledger-entry.entity';

const createEntry = (
  direction: LedgerDirection,
  balanceBefore: string,
  amount: string,
  balanceAfter: string,
) =>
  new WalletLedgerEntry({
    walletId: '00000000-0000-4000-8000-000000000001',
    transactionId: '00000000-0000-4000-8000-000000000002',
    direction,
    money: { amount, currency: 'BRL' },
    balanceBefore: { amount: balanceBefore, currency: 'BRL' },
    balanceAfter: { amount: balanceAfter, currency: 'BRL' },
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  });

describe('WalletLedgerEntry', () => {
  it('recognizes balanced credit and debit entries', () => {
    const credit = createEntry(
      LedgerDirection.Credit,
      '100.00',
      '25.00',
      '125.00',
    );
    const debit = createEntry(
      LedgerDirection.Debit,
      '100.00',
      '25.00',
      '75.00',
    );

    expect(credit.isBalanced()).toBe(true);
    expect(debit.isBalanced()).toBe(true);
  });

  it('detects an entry that does not balance', () => {
    const entry = createEntry(
      LedgerDirection.Debit,
      '100.00',
      '25.00',
      '80.00',
    );

    expect(entry.isBalanced()).toBe(false);
  });
});
