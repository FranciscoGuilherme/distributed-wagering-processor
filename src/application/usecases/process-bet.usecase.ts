import { Inject, Injectable } from '@nestjs/common';
import { WAGER_TRANSACTION_REPOSITORY } from '../../infra/repositories/typeorm/wager-transaction.repository';
import type WagerTransactionRepositoryInterface from '../../domain/repositories/wager-transaction-repository.interface';
import { UnitOfWork } from '../../infra/repositories/unit-of-work';
import { EntityManager } from 'typeorm';
import Decimal from 'decimal.js';
import Money from '../../domain/@shared/value-objects/money.vo';
import { WagerTransactionStatus } from '../../domain/entities/wager-transaction.entity';
import WagerTransactionFactory from '../../domain/factories/wager-transaction.factory';
import WalletLedgerEntryFactory from '../../domain/factories/wallet-ledger-entry.factory';
import type WalletRepositoryInterface from '../../domain/repositories/wallet-repository.interface';
import type WalletLedgerEntryInterface from '../../domain/repositories/wallet-ledger-entry.interface';
import { WALLET_REPOSITORY } from '../../infra/repositories/typeorm/wallet.repository';
import { WALLET_LEDGER_ENTRY_REPOSITORY } from '../../infra/repositories/typeorm/wallet-ledger-entry.repository';
import { LedgerDirection } from '../../domain/entities/wallet-ledger-entry.entity';

export type ProcessBetProps = {
  idempotencyKey: string;
  providerId: string;
  externalTransactionId: string;
  playerId: string; // uuid
  walletId: string; // uuid
  roundId: string;
  gameId: string;
  kind: string;
  money: {
    amount: string;
    currency: string;
  };
};

@Injectable()
export default class ProcessBet {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(WAGER_TRANSACTION_REPOSITORY)
    private readonly wagerTransactionRepository: WagerTransactionRepositoryInterface,
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepositoryInterface,
    @Inject(WALLET_LEDGER_ENTRY_REPOSITORY)
    private readonly walletLedgerEntryRepository: WalletLedgerEntryInterface,
  ) {}

  async execute(props: ProcessBetProps): Promise<void> {
    // TODO: Criar ou localizar a WagerTransaction usando o provedor e o identificador externo.
    await this.uow.execute(async (manager: EntityManager) => {
      const wagerTransactionRepository =
        this.wagerTransactionRepository.withTransaction(manager);
      const walletRepository = this.walletRepository.withTransaction(manager);
      const walletLedgerEntryRepository =
        this.walletLedgerEntryRepository.withTransaction(manager);

      const existing = await wagerTransactionRepository.findByIdempotencyKey(
        props.idempotencyKey,
      );

      if (existing) {
        // Comparar payloadHash:
        // igual = replay; diferente = conflito.
        return;
      }

      const wallet = await walletRepository.findById(props.walletId);
      if (!wallet) {
        throw new Error(`Wallet not found: ${props.walletId}`);
      }

      const transaction = WagerTransactionFactory.create({
        providerId: props.providerId,
        externalTransactionId: props.externalTransactionId,
        idempotencyKey: props.idempotencyKey,
        payloadHash: '',
        walletId: props.walletId,
        playerId: props.playerId,
        roundId: props.roundId,
        gameId: props.gameId,
        kind: props.kind,
        money: props.money,
        referenceExternalTransactionId: '',
        status: WagerTransactionStatus.Pending,
      });
      const money = new Money({
        amount: new Decimal(props.money.amount),
        currency: props.money.currency,
      });
      const balanceBefore = wallet.balance;
      wallet.credit(money);

      await wagerTransactionRepository.create(transaction);
      await walletRepository.create(wallet);
      await walletLedgerEntryRepository.create(
        WalletLedgerEntryFactory.create({
          walletId: wallet.id,
          transactionId: transaction.id,
          direction: LedgerDirection.Credit,
          money: {
            amount: money.value.amount.toString(),
            currency: money.value.currency,
          },
          balanceBefore: {
            amount: balanceBefore.value.amount.toString(),
            currency: balanceBefore.value.currency,
          },
          balanceAfter: {
            amount: wallet.balance.value.amount.toString(),
            currency: wallet.balance.value.currency,
          },
          createdAt: transaction.createdAt,
        }),
      );

      transaction.markProcessed();
      await wagerTransactionRepository.create(transaction);
    });
  }
}

// WagerTransaction: o pedido recebido e seu estado de processamento.
// Wallet: o saldo e as regras para mudá-lo.
// WalletLedgerEntry: a evidência de cada mudança efetiva no saldo.
