import Entity from '../@shared/entity';
import UniqueEntityId from '../@shared/value-objects/unique-entity-id.vo';

export type OutboxMessageProps = {
  aggregateId: string;
  eventType: string;
  payload: Readonly<Record<string, unknown>>;
  occurredAt: Date;
  attempts: number;
  nextAttemptAt?: Date;
  publishedAt?: Date;
};

export default class OutboxMessage extends Entity<OutboxMessageProps> {
  public readonly aggregateId: string;
  public readonly eventType: string;
  public readonly payload: Readonly<Record<string, unknown>>;
  public readonly occurredAt: Date;
  private _attempts: number;
  private _nextAttemptAt?: Date;
  private _publishedAt?: Date;

  constructor(props: OutboxMessageProps, id?: string) {
    super(props, new UniqueEntityId(id));
    this.aggregateId = props.aggregateId;
    this.eventType = props.eventType;
    this.payload = props.payload;
    this.occurredAt = props.occurredAt;
    this._attempts = props.attempts;
    this._nextAttemptAt = props.nextAttemptAt;
    this._publishedAt = props.publishedAt;
  }

  get attempts(): number {
    return this._attempts;
  }

  get nextAttemptAt(): Date | undefined {
    return this._nextAttemptAt;
  }

  get publishedAt(): Date | undefined {
    return this._publishedAt;
  }

  validate(): void {}
}
