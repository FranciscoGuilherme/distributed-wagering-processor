import WagerTransactionFactory from '../factories/wager-transaction.factory';
import {
  WagerTransactionKind,
  WagerTransactionStatus,
} from './wager-transaction.entity';

const createTransaction = (
  kind: WagerTransactionKind = WagerTransactionKind.Bet,
  status: WagerTransactionStatus = WagerTransactionStatus.Pending,
) =>
  WagerTransactionFactory.create({
    providerId: 'provider-a',
    externalTransactionId: 'transaction-1',
    idempotencyKey: 'provider-a:transaction-1',
    payloadHash: 'hash',
    walletId: '00000000-0000-4000-8000-000000000001',
    playerId: 'player-1',
    roundId: 'round-1',
    gameId: 'game-1',
    kind,
    money: { amount: '25.00', currency: 'BRL' },
    status,
  });

describe('WagerTransaction', () => {
  it('starts in the supplied status and allows valid transitions', () => {
    const transaction = createTransaction();

    expect(transaction.status).toBe(WagerTransactionStatus.Pending);

    transaction.markPendingReference();
    expect(transaction.status).toBe(WagerTransactionStatus.PendingReference);

    transaction.markProcessed({ amount: '75.00', currency: 'BRL' });
    expect(transaction.status).toBe(WagerTransactionStatus.Processed);
  });

  it('rejects a transition after reaching a terminal status', () => {
    const transaction = createTransaction();
    transaction.markProcessed({ amount: '75.00', currency: 'BRL' });

    expect(() => transaction.markPendingReference()).toThrow();
    expect(transaction.status).toBe(WagerTransactionStatus.Processed);
  });

  it('allows refund only for a processed bet', () => {
    const processedBet = createTransaction();
    processedBet.markProcessed({ amount: '75.00', currency: 'BRL' });

    const pendingBet = createTransaction();
    const processedWin = createTransaction(WagerTransactionKind.Win);
    processedWin.markProcessed({ amount: '125.00', currency: 'BRL' });

    expect(processedBet.isAllowedToRefound()).toBe(true);
    expect(pendingBet.isAllowedToRefound()).toBe(false);
    expect(processedWin.isAllowedToRefound()).toBe(false);
  });
});
