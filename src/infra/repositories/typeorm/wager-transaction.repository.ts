import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import IdempotencyKeyAlreadyExistsError from '../../../domain/@shared/errors/idempotency-key-already-exists.error';
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
    try {
      await this.repository.save(WagerTransactionMapper.toPersistence(entity));
    } catch (error) {
      if (!this.isIdempotencyKeyUniqueViolation(error)) {
        throw error;
      }

      throw new IdempotencyKeyAlreadyExistsError(
        'A transaction with this idempotency key already exists',
      );
    }
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

  private isIdempotencyKeyUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as {
      code?: string;
      constraint?: string;
    };

    return (
      driverError.code === '23505' &&
      driverError.constraint === 'uq_wager_transactions_idempotency_key'
    );
  }
}
