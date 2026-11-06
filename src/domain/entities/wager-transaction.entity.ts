import Decimal from 'decimal.js';
import { SYSTEM_MESSAGES } from '../../shared/constants/system-messages';
import type { FailureCode } from '../@shared/constants/failure-codes';
import Entity from '../@shared/entity';
import Money from '../@shared/value-objects/money.vo';
import UniqueEntityId from '../@shared/value-objects/unique-entity-id.vo';

export enum WagerTransactionKind {
  Opening = 'OPENING',
  Bet = 'BET',
  Win = 'WIN',
  Loss = 'LOSS',
  Refund = 'REFUND',
  Rollback = 'ROLLBACK',
}

export enum WagerTransactionStatus {
  Pending = 'PENDING', // aceita, ainda não aplicada
  PendingReference = 'PENDING_REFERENCE', // aguardando a transação referenciada
  Processed = 'PROCESSED', // aplicada (terminal)
  Rejected = 'REJECTED', // violação de regra de negócio (terminal)
  Failed = 'FAILED', // erro permanente de infraestrutura (terminal, auditável)
}

export type WagerTransactionBalance = {
  amount: string;
  currency: string;
};

export type WagerTransactionProps = {
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: string;
  money: {
    amount: string;
    currency: string;
  };
  referenceExternalTransactionId?: string;
  createdAt?: Date;
  status: string;
  referenceTransactionId?: string;
  failureCode?: FailureCode;
  processedAt?: Date;
  resultBalance?: WagerTransactionBalance;
};

export default class WagerTransaction extends Entity<WagerTransactionProps> {
  public readonly providerId: string;
  public readonly externalTransactionId: string;
  public readonly idempotencyKey: string;
  public readonly payloadHash: string;
  public readonly walletId: string;
  public readonly playerId: string;
  public readonly roundId: string;
  public readonly gameId: string;
  public readonly kind: WagerTransactionKind;
  public readonly money: Money;
  public readonly referenceExternalTransactionId?: string;
  public readonly createdAt: Date;
  private _status: WagerTransactionStatus;
  private _referenceTransactionId?: string;
  private _failureCode?: FailureCode;
  private _processedAt?: Date;
  private _resultBalance?: WagerTransactionBalance;

  constructor(props: WagerTransactionProps, id?: string) {
    super(props, new UniqueEntityId(id));
    this.providerId = props.providerId;
    this.externalTransactionId = props.externalTransactionId;
    this.idempotencyKey = props.idempotencyKey;
    this.payloadHash = props.payloadHash;
    this.walletId = props.walletId;
    this.playerId = props.playerId;
    this.roundId = props.roundId;
    this.gameId = props.gameId;
    this.kind = props.kind as WagerTransactionKind;
    this.money = new Money({
      amount: new Decimal(props.money.amount),
      currency: props.money.currency,
    });
    this.referenceExternalTransactionId = props.referenceExternalTransactionId;
    this.createdAt = props?.createdAt || new Date();
    this._status = props.status as WagerTransactionStatus;
    this._referenceTransactionId = props?.referenceTransactionId;
    this._failureCode = props?.failureCode;
    this._processedAt = props?.processedAt;
    this._resultBalance = props.resultBalance;
  }

  validate(): void {}

  get status(): WagerTransactionStatus {
    return this._status;
  }

  get referenceTransactionId(): string | undefined {
    return this._referenceTransactionId;
  }

  setReferenceTransactionId(referenceTransactionId: string): void {
    this._referenceTransactionId = referenceTransactionId;
  }

  get failureCode(): FailureCode | undefined {
    return this._failureCode;
  }

  get processedAt(): Date | undefined {
    return this._processedAt;
  }

  get resultBalance(): WagerTransactionBalance | undefined {
    return this._resultBalance;
  }

  markProcessed(resultBalance: WagerTransactionBalance): void {
    this.assertNotTerminal();
    this._status = WagerTransactionStatus.Processed;
    this._resultBalance = { ...resultBalance };
    this._processedAt = new Date();
  }

  markPendingReference(): void {
    this.assertNotTerminal();
    this._status = WagerTransactionStatus.PendingReference;
    this._processedAt = new Date();
  }

  reject(
    failureCode: FailureCode,
    resultBalance?: WagerTransactionBalance,
  ): void {
    this.assertNotTerminal();
    this._status = WagerTransactionStatus.Rejected;
    this._failureCode = failureCode;
    this._resultBalance = resultBalance;
    this._processedAt = new Date();
  }

  isAllowedToRefound(): boolean {
    if (
      this.kind !== WagerTransactionKind.Bet ||
      this.status !== WagerTransactionStatus.Processed
    ) {
      return false;
    }
    return true;
  }

  private assertNotTerminal(): void {
    const terminalStatuses = [
      WagerTransactionStatus.Processed,
      WagerTransactionStatus.Rejected,
      WagerTransactionStatus.Failed,
    ];

    if (terminalStatuses.includes(this._status)) {
      throw new Error(SYSTEM_MESSAGES.DOMAIN.TERMINAL_TRANSACTION_TRANSITION);
    }
  }
}

// TODO: Dificuldade em entender a relação dessa entidade com o fluxo e as outras entidades
