import Entity from '../@shared/entity';
import UniqueEntityId from '../@shared/value-objects/unique-entity-id.vo';

export type InboxMessageProps = {
  consumerName: string;
  payloadHash: string;
  receivedAt: Date;
  processedAt?: Date;
};

export default class InboxMessage extends Entity<InboxMessageProps> {
  public readonly consumerName!: string;
  public readonly payloadHash!: string;
  public readonly receivedAt!: Date;
  private _processedAt!: Date;

  constructor(props: InboxMessageProps, id?: string) {
    super(props, new UniqueEntityId(id));
    this.validate();
  }

  validate(): void {}
}
