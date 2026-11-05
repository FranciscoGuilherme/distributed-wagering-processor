import EntityInterface from "./entity.interface";

export default interface RepositoryInterface<E extends EntityInterface> {
  findAll(): Promise<E[]>;
  findById(id: string): Promise<E | null>;
  create(item: E): Promise<E>;
  update(id: string, item: Partial<E>): Promise<E | null>;
  delete(id: string): Promise<boolean>;
}
