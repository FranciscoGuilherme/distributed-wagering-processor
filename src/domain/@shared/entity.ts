import EntityInterface from "./entity.interface";
import UniqueEntityId from "./value-objects/unique-entity-id.vo";

export default abstract class Entity<Props> implements EntityInterface {
  public readonly uniqueEntityId: UniqueEntityId;

  protected constructor(
    protected readonly props: Props,
    id?: UniqueEntityId,
  ) {
    this.uniqueEntityId = id || new UniqueEntityId();
  }

  get id(): string {
    return this.uniqueEntityId.value;
  }

  toJSON(): Required<{ id: string } & Props> {
    return {
      id: this.uniqueEntityId.value,
      ...this.props,
    } as Required<{ id: string } & Props>;
  }
}
