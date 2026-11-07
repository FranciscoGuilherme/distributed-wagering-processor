import Decimal from 'decimal.js';
import Money from '../@shared/value-objects/money.vo';
import WalletAggregate from './wallet.aggregate';

const createWallet = () =>
  new WalletAggregate(
    {
      id: '00000000-0000-4000-8000-000000000001',
      playerId: 'player-1',
      currency: 'BRL',
      balance: { amount: '100.00', currency: 'BRL' },
      version: 1,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    },
    '00000000-0000-4000-8000-000000000001',
  );

const brl = (amount: string) =>
  new Money({ amount: new Decimal(amount), currency: 'BRL' });

describe('WalletAggregate', () => {
  it('updates the balance after debit and credit', () => {
    const wallet = createWallet();

    wallet.debit(brl('25.00'));
    expect(wallet.balance.value.amount.toFixed(2)).toBe('75.00');

    wallet.credit(brl('25.00'));
    expect(wallet.balance.value.amount.toFixed(2)).toBe('100.00');
  });

  it('rejects a debit above the balance without changing it', () => {
    const wallet = createWallet();

    expect(() => wallet.debit(brl('125.00'))).toThrow();
    expect(wallet.balance.value.amount.toFixed(2)).toBe('100.00');
  });

  it('rejects an operation in a different currency', () => {
    const wallet = createWallet();
    const usd = new Money({
      amount: new Decimal('25.00'),
      currency: 'USD',
    });

    expect(() => wallet.debit(usd)).toThrow();
    expect(wallet.balance.value.amount.toFixed(2)).toBe('100.00');
  });
});
