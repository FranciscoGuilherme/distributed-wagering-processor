import { Inject, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { isNull, isUndefined } from 'lodash';
import { EntityManager } from 'typeorm';
import ReferenceTransactionIdMissing from '../../domain/@shared/errors/reference-transaction-id-missing.error';
import RefoundNotAllowedError from '../../domain/@shared/errors/refound-not-allowed.error';
import { WagerTransactionStatus } from '../../domain/entities/wager-transaction.entity';
import WagerTransactionFactory from '../../domain/factories/wager-transaction.factory';
import type WagerTransactionRepositoryInterface from '../../domain/repositories/wager-transaction-repository.interface';
import type WalletLedgerEntryInterface from '../../domain/repositories/wallet-ledger-entry.interface';
import type WalletRepositoryInterface from '../../domain/repositories/wallet-repository.interface';
import { WAGER_TRANSACTION_REPOSITORY } from '../../infra/repositories/typeorm/wager-transaction.repository';
import { WALLET_LEDGER_ENTRY_REPOSITORY } from '../../infra/repositories/typeorm/wallet-ledger-entry.repository';
import { WALLET_REPOSITORY } from '../../infra/repositories/typeorm/wallet.repository';
import { UnitOfWork } from '../../infra/repositories/unit-of-work';
import { ProcessOperationProps } from './process-operation.usecase';

@Injectable()
export default class ProcessKindRefoundUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepositoryInterface,
    @Inject(WALLET_LEDGER_ENTRY_REPOSITORY)
    private readonly walletLedgerEntryRepository: WalletLedgerEntryInterface,
    @Inject(WAGER_TRANSACTION_REPOSITORY)
    private readonly wagerTransactionRepository: WagerTransactionRepositoryInterface,
  ) {}

  async execute(
    props: ProcessOperationProps,
    payloadHash: string,
  ): Promise<void> {
    await this.uow.execute(async (manager: EntityManager) => {
      const walletRepository = this.walletRepository.withTransaction(manager);
      const walletLedgerEntryRepository =
        this.walletLedgerEntryRepository.withTransaction(manager);
      const wagerTransactionRepository =
        this.wagerTransactionRepository.withTransaction(manager);

      // TODO REFUND-01 — Exigir referenceExternalTransactionId no payload.
      // Ela identifica a transação do provedor a ser reembolsada.
      if (
        isNull(props.referenceExternalTransactionId) ||
        isUndefined(props.referenceExternalTransactionId)
      ) {
        throw new ReferenceTransactionIdMissing(
          'referenceExternalTransactionId not found',
        );
      }

      // TODO REFUND-02 — Depois da verificação de idempotência, localizar a
      // referência por providerId + referenceExternalTransactionId e bloqueá-la
      // para escrita dentro da transação.
      const wagerTransactionReference =
        await wagerTransactionRepository.findByProviderAndExternalTransactionIdForUpdate(
          props.providerId,
          props.referenceExternalTransactionId,
        );

      // TODO REFUND-03 — Se a referência ainda não existir, salvar esta operação
      // como PENDING_REFERENCE, publicar o evento no Outbox e não alterar carteira
      // nem criar ledger. Ela será reprocessada depois.
      if (isNull(wagerTransactionReference)) {
        const wagerTransaction = WagerTransactionFactory.create({
          providerId: props.providerId,
          externalTransactionId: props.externalTransactionId,
          idempotencyKey: props.idempotencyKey,
          payloadHash: payloadHash,
          walletId: props.walletId,
          playerId: props.playerId,
          roundId: props.roundId,
          gameId: props.gameId,
          kind: props.kind,
          money: {
            amount: props.money.amount,
            currency: props.money.currency,
          },
          referenceExternalTransactionId: props.externalTransactionId,
          status: WagerTransactionStatus.PendingReference,
          referenceTransactionId: props.referenceExternalTransactionId,
        });
        await wagerTransactionRepository.create(wagerTransaction);

        return {
          transactionId: wagerTransaction.id,
          status: wagerTransaction.status,
          balance: wagerTransaction.resultBalance,
          idempotentReplay: false,
        };
      }

      // TODO REFUND-04 — Confirmar que a referência está PROCESSED e que seu kind
      // é BET. Qualquer outro kind ou status deve resultar em rejeição de negócio.
      if (!wagerTransactionReference.isAllowedToRefound()) {
        throw new RefoundNotAllowedError('REFOUND not allowed');
      }

      // TODO REFUND-05 — Confirmar que referência e refund pertencem ao mesmo
      // provider, player, wallet, moeda e round.
      if (
        wagerTransactionReference.providerId !== props.providerId ||
        wagerTransactionReference.playerId !== props.playerId ||
        wagerTransactionReference.walletId !== props.walletId ||
        wagerTransactionReference.roundId !== props.roundId
      ) {
        throw new RefoundNotAllowedError('REFOUND not allowed');
      }

      // TODO REFUND-06 — Confirmar que o valor do refund é exatamente igual ao da
      // BET referenciada. Reembolso parcial está fora do escopo.
      if (
        wagerTransactionReference.money.value.amount.equals(
          new Decimal(props.money.amount),
        )
      ) {
        throw new RefoundNotAllowedError(
          'Amount of the referente transaction is not equal to current value',
        );
      }

      // TODO REFUND-07 — Confirmar que a BET ainda não foi reembolsada.
      // Proteger também essa regra no banco com unicidade para
      // (reference_transaction_id, kind) nos casos REFUND e ROLLBACK.

      // TODO REFUND-08 — Bloquear a linha da carteira e validar novamente que ela
      // pertence ao player e usa a moeda do refund.

      // TODO REFUND-09 — Creditar o valor do refund. Guardar o saldo antes e depois.

      // TODO REFUND-10 — Criar exatamente um ledger CREDIT, ligado à carteira,
      // à transação REFUND e à transação interna referenciada.

      // TODO REFUND-11 — Marcar o refund como PROCESSED, guardar referenceTransactionId
      // interno, processedAt e o resultBalance original para futuros replays.

      // TODO REFUND-12 — Persistir a transação, carteira, ledger e eventos de Outbox
      // na mesma transação SQL. WalletBalanceChanged só é emitido se o saldo mudou.

      // TODO REFUND-13 — Se a entrada for SQS, gravar o Inbox por
      // (consumerName, messageId) na mesma transação. Entrada HTTP não usa Inbox.

      // TODO REFUND-14 — Tratar rejeições de negócio com failureCode estável e
      // persistir REJECTED sem ledger. Falhas de infraestrutura devem provocar
      // rollback.

      // TODO REFUND-15 — Se houver corrida ao criar outro refund da mesma referência,
      // reconhecer a violação da constraint única e devolver conflito/replay
      // conforme idempotencyKey e payloadHash.
    });
  }
}
