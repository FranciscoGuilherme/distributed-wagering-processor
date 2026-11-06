import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import WagerTransaction, {
  WagerTransactionKind,
} from '../../../domain/entities/wager-transaction.entity';
import WagerTransactionRepositoryInterface from '../../../domain/repositories/wager-transaction-repository.interface';
import WagerTransactionMapper from '../../mappers/wager-transaction.mapper';
import { WagerTransactionModel } from '../../models/wager-transaction.model';

export const WAGER_TRANSACTION_REPOSITORY = Symbol(
  'WAGER_TRANSACTION_REPOSITORY',
);

@Injectable()
export default class WagerTransactionRepository implements WagerTransactionRepositoryInterface {
  constructor(
    @InjectRepository(WagerTransactionModel)
    private readonly repository: Repository<WagerTransactionModel>,
  ) {}

  withTransaction(manager: EntityManager): WagerTransactionRepositoryInterface {
    return new WagerTransactionRepository(
      manager.getRepository(WagerTransactionModel),
    );
  }

  async findById(id: string): Promise<WagerTransaction | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? WagerTransactionMapper.toEntity(model) : null;
  }

  async create(entity: WagerTransaction): Promise<void> {
    await this.repository.save(WagerTransactionMapper.toPersistence(entity));
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<WagerTransaction | null> {
    const model = await this.repository.findOne({ where: { idempotencyKey } });
    return model ? WagerTransactionMapper.toEntity(model) : null;
  }

  async findByProviderAndExternalTransactionIdForUpdate(
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransaction | null> {
    const model = await this.repository.findOne({
      where: { providerId, externalTransactionId },
      lock: { mode: 'pessimistic_write' },
    });

    return model ? WagerTransactionMapper.toEntity(model) : null;
  }

  async findRefundByReferenceTransactionId(
    referenceTransactionId: string,
  ): Promise<WagerTransaction | null> {
    const model = await this.repository.findOneBy({
      referenceTransactionId,
      kind: WagerTransactionKind.Refund,
    });
    return model ? WagerTransactionMapper.toEntity(model) : null;
  }

  async findRollbackByReferenceTransactionId(
    referenceTransactionId: string,
  ): Promise<WagerTransaction | null> {
    const model = await this.repository.findOneBy({
      referenceTransactionId,
      kind: WagerTransactionKind.Rollback,
    });
    return model ? WagerTransactionMapper.toEntity(model) : null;
  }
}
