import Entity from '../@shared/entity';
import Money from '../@shared/value-objects/money.vo';
import UniqueEntityId from '../@shared/value-objects/unique-entity-id.vo';

enum WagerTransactionKind {
  Opening = 'OPENING',
  Bet = 'BET',
  Win = 'WIN',
  Loss = 'LOSS',
  Refund = 'REFUND',
  Rollback = 'ROLLBACK',
}

enum WagerTransactionStatus {
  Pending = 'PENDING', // aceita, ainda não aplicada
  PendingReference = 'PENDING_REFERENCE', // aguardando a transação referenciada
  Processed = 'PROCESSED', // aplicada (terminal)
  Rejected = 'REJECTED', // violação de regra de negócio (terminal)
  Failed = 'FAILED', // erro permanente de infraestrutura (terminal, auditável)
}

export type FailureCode = 'BN-001' | 'BN-002' | 'BN-003';

export type WagerTransactionProps = {
  id: string;
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  money: Money;
  referenceExternalTransactionId: string | undefined;
  createdAt: Date;
  _status: WagerTransactionStatus;
  _referenceTransactionId?: string;
  _failureCode?: FailureCode;
  _processedAt?: Date;
};

export default class WagerTransaction extends Entity<WagerTransactionProps> {
  public readonly providerId!: string;
  public readonly externalTransactionId!: string;
  public readonly idempotencyKey!: string;
  public readonly payloadHash!: string;
  public readonly walletId!: string;
  public readonly playerId!: string;
  public readonly roundId!: string;
  public readonly gameId!: string;
  public readonly kind!: WagerTransactionKind;
  public readonly money!: Money;
  public readonly referenceExternalTransactionId!: string | undefined;
  public readonly createdAt!: Date;
  private _status!: WagerTransactionStatus;
  private _referenceTransactionId!: string;
  private _failureCode!: FailureCode;
  private _processedAt!: Date;

  constructor(props: WagerTransactionProps, id?: string) {
    super(props, new UniqueEntityId(id));
    Object.assign(this, props);
  }

  get status(): WagerTransactionStatus {
    return this._status;
  }

  get referenceTransactionId(): string | undefined {
    return this._referenceTransactionId;
  }

  get failureCode(): FailureCode | undefined {
    return this._failureCode;
  }

  get processedAt(): Date | undefined {
    return this._processedAt;
  }
}

// TODO: Dificuldade em entender a relação dessa entidade com o fluxo e as outras entidades
