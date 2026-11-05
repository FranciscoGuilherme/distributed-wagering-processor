import EntityInterface from './entity.interface';

export default interface RepositoryInterface<E extends EntityInterface> {
  withTransaction(manager: any): RepositoryInterface<E>;
  // findAll(): Promise<E[]>;
  findById(id: string): Promise<E | null>;
  create(item: E): Promise<void>;
  // update(id: string, item: Partial<E>): Promise<E | null>;
  // delete(id: string): Promise<boolean>;
}
