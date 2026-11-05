import Entity from "./entity";
import UniqueEntityId from "./value-objects/unique-entity-id.vo";

export abstract class AggregateRoot<Props> extends Entity<Props> {
  constructor(props: Props, id?: UniqueEntityId) {
    super(props, id);
  }
}
