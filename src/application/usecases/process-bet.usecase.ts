import { Inject, Injectable } from '@nestjs/common';
import { WAGER_TRANSACTION_REPOSITORY } from '../../infra/repositories/typeorm/wager-transaction.repository';
import type WagerTransactionRepositoryInterface from '../../domain/repositories/wager-transaction-repository.interface';
import { UnitOfWork } from '../../infra/repositories/unit-of-work';
import { EntityManager } from 'typeorm';
import Decimal from 'decimal.js';
import Money from '../../domain/@shared/value-objects/money.vo';
import { WagerTransactionStatus } from '../../domain/entities/wager-transaction.entity';
import type { WagerTransactionBalance } from '../../domain/entities/wager-transaction.entity';
import WagerTransactionFactory from '../../domain/factories/wager-transaction.factory';
import WalletLedgerEntryFactory from '../../domain/factories/wallet-ledger-entry.factory';
import type WalletRepositoryInterface from '../../domain/repositories/wallet-repository.interface';
import type WalletLedgerEntryInterface from '../../domain/repositories/wallet-ledger-entry.interface';
import { WALLET_REPOSITORY } from '../../infra/repositories/typeorm/wallet.repository';
import { WALLET_LEDGER_ENTRY_REPOSITORY } from '../../infra/repositories/typeorm/wallet-ledger-entry.repository';
import { LedgerDirection } from '../../domain/entities/wallet-ledger-entry.entity';
import { createHash } from 'crypto';
import IdempotencyConflictError from '../../domain/@shared/errors/idempotency-conflict.error';
import WagerTransaction from '../../domain/entities/wager-transaction.entity';

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

export type ProcessBetResult = {
  transactionId: string;
  status: WagerTransactionStatus;
  balance: WagerTransactionBalance;
  idempotentReplay: boolean;
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

  async execute(props: ProcessBetProps): Promise<ProcessBetResult> {
    const payloadHash = this.createPayloadHash(props);

    try {
      return await this.uow.execute(async (manager: EntityManager) => {
        const walletRepository = this.walletRepository.withTransaction(manager);
        const walletLedgerEntryRepository =
          this.walletLedgerEntryRepository.withTransaction(manager);
        const wagerTransactionRepository =
          this.wagerTransactionRepository.withTransaction(manager);

        const existing = await wagerTransactionRepository.findByIdempotencyKey(
          props.idempotencyKey,
        );
        if (existing) {
          return this.toReplayResult(existing, payloadHash);
        }

        const wagerTransaction = WagerTransactionFactory.create({
          providerId: props.providerId,
          externalTransactionId: props.externalTransactionId,
          idempotencyKey: props.idempotencyKey,
          payloadHash,
          walletId: props.walletId,
          playerId: props.playerId,
          roundId: props.roundId,
          gameId: props.gameId,
          kind: props.kind,
          money: props.money,
          status: WagerTransactionStatus.Pending,
        });
        await wagerTransactionRepository.create(wagerTransaction);

        const wallet = await walletRepository.findByIdForUpdate(props.walletId);
        if (!wallet) {
          throw new Error(`Wallet not found: ${props.walletId}`);
        }

        const money = new Money({
          amount: new Decimal(props.money.amount),
          currency: props.money.currency,
        });

        const balanceBefore = wallet.balance;
        wallet.credit(money);
        const balanceAfter = this.toBalanceSnapshot(wallet.balance);

        await walletRepository.create(wallet);
        await walletLedgerEntryRepository.create(
          WalletLedgerEntryFactory.create({
            walletId: wallet.id,
            transactionId: wagerTransaction.id,
            direction: LedgerDirection.Credit,
            money: {
              amount: money.value.amount.toFixed(2),
              currency: money.value.currency,
            },
            balanceBefore: this.toBalanceSnapshot(balanceBefore),
            balanceAfter,
            createdAt: wagerTransaction.createdAt,
          }),
        );

        wagerTransaction.markProcessed(balanceAfter);
        await wagerTransactionRepository.create(wagerTransaction);

        return {
          transactionId: wagerTransaction.id,
          status: wagerTransaction.status,
          balance: balanceAfter,
          idempotentReplay: false,
        };
      });
    } catch (error) {
      const existing =
        await this.wagerTransactionRepository.findByIdempotencyKey(
          props.idempotencyKey,
        );
      if (!existing) {
        throw error;
      }
      return this.toReplayResult(existing, payloadHash);
    }
  }

  private toReplayResult(
    existing: WagerTransaction,
    payloadHash: string,
  ): ProcessBetResult {
    if (existing.payloadHash !== payloadHash) {
      throw new IdempotencyConflictError(
        'A Idempotency-Key já foi usada com outro payload',
      );
    }

    if (!existing.resultBalance) {
      throw new Error(
        `A transação ${existing.id} não tem o saldo do resultado salvo`,
      );
    }

    return {
      transactionId: existing.id,
      status: existing.status,
      balance: existing.resultBalance,
      idempotentReplay: true,
    };
  }

  private createPayloadHash(props: ProcessBetProps): string {
    const canonicalPayload = {
      externalTransactionId: props.externalTransactionId,
      gameId: props.gameId,
      kind: props.kind,
      money: {
        amount: props.money.amount,
        currency: props.money.currency,
      },
      playerId: props.playerId,
      providerId: props.providerId,
      roundId: props.roundId,
      walletId: props.walletId,
    };

    return createHash('sha256')
      .update(JSON.stringify(canonicalPayload), 'utf8')
      .digest('hex');
  }

  private toBalanceSnapshot(money: Money): WagerTransactionBalance {
    return {
      amount: money.value.amount.toFixed(2),
      currency: money.value.currency,
    };
  }
}
