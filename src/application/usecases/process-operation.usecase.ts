import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import Decimal from 'decimal.js';
import { EntityManager } from 'typeorm';
import IdempotencyConflictError from '../../domain/@shared/errors/idempotency-conflict.error';
import Money from '../../domain/@shared/value-objects/money.vo';
import type { WagerTransactionBalance } from '../../domain/entities/wager-transaction.entity';
import WagerTransaction, {
  WagerTransactionKind,
  WagerTransactionStatus,
} from '../../domain/entities/wager-transaction.entity';
import { LedgerDirection } from '../../domain/entities/wallet-ledger-entry.entity';
import WalletAggregate from '../../domain/entities/wallet.aggregate';
import WagerTransactionFactory from '../../domain/factories/wager-transaction.factory';
import WalletLedgerEntryFactory from '../../domain/factories/wallet-ledger-entry.factory';
import type WagerTransactionRepositoryInterface from '../../domain/repositories/wager-transaction-repository.interface';
import type WalletLedgerEntryInterface from '../../domain/repositories/wallet-ledger-entry.interface';
import type WalletRepositoryInterface from '../../domain/repositories/wallet-repository.interface';
import { WAGER_TRANSACTION_REPOSITORY } from '../../infra/repositories/typeorm/wager-transaction.repository';
import { WALLET_LEDGER_ENTRY_REPOSITORY } from '../../infra/repositories/typeorm/wallet-ledger-entry.repository';
import { WALLET_REPOSITORY } from '../../infra/repositories/typeorm/wallet.repository';
import { UnitOfWork } from '../../infra/repositories/unit-of-work';
import ProcessKindRefoundUseCase from './process-kind-refound.usecase';

export type ProcessOperationProps = {
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
  referenceExternalTransactionId?: string;
};

export type ProcessOperationResult = {
  transactionId: string;
  status: WagerTransactionStatus;
  balance?: WagerTransactionBalance;
  idempotentReplay: boolean;
};

@Injectable()
export default class ProcessOperationUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(WAGER_TRANSACTION_REPOSITORY)
    private readonly wagerTransactionRepository: WagerTransactionRepositoryInterface,
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepositoryInterface,
    @Inject(WALLET_LEDGER_ENTRY_REPOSITORY)
    private readonly walletLedgerEntryRepository: WalletLedgerEntryInterface,
    private readonly processKindRefoundUseCase: ProcessKindRefoundUseCase,
  ) {}

  async execute(props: ProcessOperationProps): Promise<ProcessOperationResult> {
    // TODO 01 — Validar a entrada antes de consultar ou alterar o banco:
    // campos obrigatórios, UUIDs, kind permitido (OPENING é interno),
    // valor decimal positivo com até duas casas e moeda aceita.
    // Depois da validação, garantir que o hash use uma representação
    // canônica dos dados de negócio.
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
          referenceExternalTransactionId: props.referenceExternalTransactionId,
          money: props.money,
          status: WagerTransactionStatus.Pending,
        });

        if (props.kind === WagerTransactionKind.Refund) {
          return this.processKindRefoundUseCase.execute(
            props,
            manager,
            wagerTransaction,
          );
        }

        await wagerTransactionRepository.create(wagerTransaction);

        // TODO 02 — Para ROLLBACK, localizar a referência por providerId + ID
        // externo e consultar se ela já foi revertida por esse tipo.
        let reference: WagerTransaction | undefined;
        let referenceAlreadyReversed = false;

        const wallet = await walletRepository.findByIdForUpdate(props.walletId);
        if (!wallet) {
          throw new Error(`Wallet not found: ${props.walletId}`);
        }

        // TODO 03 — Validar que a carteira pertence ao playerId e que sua
        // moeda corresponde à moeda da operação. Confirmar que a atualização
        // do saldo fica protegida pelo lock e pela transação SQL.
        const money = new Money({
          amount: new Decimal(props.money.amount),
          currency: props.money.currency,
        });

        const balanceBefore = wallet.balance;
        let ledgerDirection: LedgerDirection;

        switch (props.kind) {
          case WagerTransactionKind.Bet:
            await this.processKindBetUseCase(
              money,
              wallet,
              wagerTransaction,
              walletRepository,
              walletLedgerEntryRepository,
            );
            break;

          case WagerTransactionKind.Win:
            await this.processKindWinUseCase(
              money,
              wallet,
              wagerTransaction,
              walletRepository,
              walletLedgerEntryRepository,
            );
            break;

          case WagerTransactionKind.Loss:
            this.processKindLossUseCase(wallet);
            break;

          case WagerTransactionKind.Rollback:
            if (!reference) {
              throw new Error(
                'TODO: tratar referência ausente como PENDING_REFERENCE',
              );
            }

            await this.processKindRollbackUseCase(
              money,
              wallet,
              wagerTransaction,
              reference,
              referenceAlreadyReversed,
              walletRepository,
              walletLedgerEntryRepository,
            );
            break;

          case WagerTransactionKind.Opening:
          default:
            throw new Error(`Unsupported transaction kind: ${props.kind}`);
        }

        // TODO 04 — Tratar erros de negócio dentro desta unidade de trabalho:
        // saldo insuficiente em BET ou ROLLBACK deve persistir REJECTED,
        // failureCode estável e saldo observado, sem criar ledger. Distinguir
        // isso de erro de infraestrutura, que deve provocar rollback.

        // TODO 05 — Serializar valores monetários sempre com duas casas
        // decimais. Permitir saldo zero, mantendo a validação de que o valor
        // da operação submetida deve ser positivo.

        // TODO 06 — Gravar eventos de Outbox na mesma transação SQL:
        // Processed ou Rejected, PendingReference quando aplicável e
        // WalletBalanceChanged somente quando o saldo mudar.
        // Para entrada SQS, gravar Inbox por (consumerName, messageId) também
        // nesta transação. Entrada HTTP não usa Inbox.

        const balanceAfter = this.toBalanceSnapshot(wallet.balance);

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
  ): ProcessOperationResult {
    if (existing.payloadHash !== payloadHash) {
      throw new IdempotencyConflictError(
        'A Idempotency-Key já foi usada com outro payload',
      );
    }

    if (
      !existing.resultBalance &&
      existing.status !== WagerTransactionStatus.PendingReference
    ) {
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

  private createPayloadHash(props: ProcessOperationProps): string {
    const canonicalPayload = {
      externalTransactionId: props.externalTransactionId,
      gameId: props.gameId,
      kind: props.kind,
      referenceExternalTransactionId: props.referenceExternalTransactionId,
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
      amount: new Decimal(money.value.amount).toString(),
      currency: money.value.currency,
    };
  }

  private async processKindBetUseCase(
    money: Money,
    wallet: WalletAggregate,
    wagerTransaction: WagerTransaction,
    walletRepository: WalletRepositoryInterface,
    walletLedgerEntryRepository: WalletLedgerEntryInterface,
  ): Promise<WagerTransactionBalance> {
    const balanceBefore = wallet.balance;

    wallet.debit(money);

    return this.persistWalletEffect(
      money,
      wallet,
      wagerTransaction,
      balanceBefore,
      LedgerDirection.Debit,
      walletRepository,
      walletLedgerEntryRepository,
    );
  }

  private async processKindWinUseCase(
    money: Money,
    wallet: WalletAggregate,
    wagerTransaction: WagerTransaction,
    walletRepository: WalletRepositoryInterface,
    walletLedgerEntryRepository: WalletLedgerEntryInterface,
  ): Promise<WagerTransactionBalance> {
    const balanceBefore = wallet.balance;

    wallet.credit(money);

    return this.persistWalletEffect(
      money,
      wallet,
      wagerTransaction,
      balanceBefore,
      LedgerDirection.Credit,
      walletRepository,
      walletLedgerEntryRepository,
    );
  }

  private processKindLossUseCase(
    wallet: WalletAggregate,
  ): WagerTransactionBalance {
    return this.toBalanceSnapshot(wallet.balance);
  }

  private async processKindRollbackUseCase(
    money: Money,
    wallet: WalletAggregate,
    wagerTransaction: WagerTransaction,
    reference: WagerTransaction,
    referenceAlreadyReversed: boolean,
    walletRepository: WalletRepositoryInterface,
    walletLedgerEntryRepository: WalletLedgerEntryInterface,
  ): Promise<WagerTransactionBalance> {
    this.validateReversalReference(
      wagerTransaction,
      money,
      wallet,
      reference,
      [
        WagerTransactionKind.Bet,
        WagerTransactionKind.Win,
        WagerTransactionKind.Refund,
      ],
      referenceAlreadyReversed,
    );

    const balanceBefore = wallet.balance;

    if (reference.kind === WagerTransactionKind.Bet) {
      wallet.credit(money);

      return this.persistWalletEffect(
        money,
        wallet,
        wagerTransaction,
        balanceBefore,
        LedgerDirection.Credit,
        walletRepository,
        walletLedgerEntryRepository,
      );
    }

    wallet.debit(money);

    return this.persistWalletEffect(
      money,
      wallet,
      wagerTransaction,
      balanceBefore,
      LedgerDirection.Debit,
      walletRepository,
      walletLedgerEntryRepository,
    );
  }

  private async persistWalletEffect(
    money: Money,
    wallet: WalletAggregate,
    wagerTransaction: WagerTransaction,
    balanceBefore: Money,
    direction: LedgerDirection,
    walletRepository: WalletRepositoryInterface,
    walletLedgerEntryRepository: WalletLedgerEntryInterface,
  ): Promise<WagerTransactionBalance> {
    const balanceAfter = this.toBalanceSnapshot(wallet.balance);

    await walletRepository.create(wallet);
    await walletLedgerEntryRepository.create(
      WalletLedgerEntryFactory.create({
        walletId: wallet.id,
        transactionId: wagerTransaction.id,
        direction,
        money: {
          amount: money.value.amount.toFixed(2),
          currency: money.value.currency,
        },
        balanceBefore: this.toBalanceSnapshot(balanceBefore),
        balanceAfter,
        createdAt: wagerTransaction.createdAt,
      }),
    );

    return balanceAfter;
  }

  private validateReversalReference(
    wagerTransaction: WagerTransaction,
    money: Money,
    wallet: WalletAggregate,
    reference: WagerTransaction,
    allowedKinds: WagerTransactionKind[],
    referenceAlreadyReversed: boolean,
  ): void {
    if (reference.status !== WagerTransactionStatus.Processed) {
      throw new Error('A transação referenciada precisa estar processada');
    }

    if (!allowedKinds.includes(reference.kind)) {
      throw new Error('Tipo de transação inválido para esta reversão');
    }

    if (
      reference.providerId !== wagerTransaction.providerId ||
      reference.playerId !== wagerTransaction.playerId ||
      reference.walletId !== wallet.id ||
      reference.roundId !== wagerTransaction.roundId
    ) {
      throw new Error('A referência não pertence ao mesmo contexto');
    }

    reference.money.assertSameCurrency(money);

    if (!reference.money.value.amount.equals(money.value.amount)) {
      throw new Error('O valor deve ser igual ao da transação referenciada');
    }

    if (referenceAlreadyReversed) {
      throw new Error('A transação referenciada já foi revertida');
    }
  }
}
