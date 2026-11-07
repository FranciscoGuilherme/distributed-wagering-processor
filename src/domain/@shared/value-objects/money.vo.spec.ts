import Decimal from 'decimal.js';
import Money from './money.vo';

describe('Money', () => {
  it('accepts a valid decimal amount', () => {
    const money = new Money({
      amount: new Decimal('25.00'),
      currency: 'BRL',
    });

    expect(money.value.amount.toFixed(2)).toBe('25.00');
    expect(money.value.currency).toBe('BRL');
  });

  it('rejects negative amounts and invalid currencies', () => {
    expect(
      () =>
        new Money({
          amount: new Decimal('-1.00'),
          currency: 'BRL',
        }),
    ).toThrow();

    expect(
      () =>
        new Money({
          amount: new Decimal('1.00'),
          currency: 'BR',
        }),
    ).toThrow();
  });

  it('rejects comparison with a different currency', () => {
    const brl = new Money({
      amount: new Decimal('25.00'),
      currency: 'BRL',
    });
    const usd = new Money({
      amount: new Decimal('25.00'),
      currency: 'USD',
    });

    expect(() => brl.assertSameCurrency(usd)).toThrow();
  });
});
