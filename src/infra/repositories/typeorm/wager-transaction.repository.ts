import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import IdempotencyKeyAlreadyExistsError from '../../../domain/@shared/errors/idempotency-key-already-exists.error';
import WagerTransaction, {
  WagerTransactionKind,
} from '../../../domain/entities/wager-transaction.entity';
import WagerTransactionRepositoryInterface from '../../../domain/repositories/wager-transaction-repository.interface';
import { SYSTEM_MESSAGES } from '../../../shared/constants/system-messages';
import {
  isPostgresUniqueConstraintViolation,
  POSTGRES_CONSTRAINTS,
} from '../../database/postgres-errors';
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
      if (
        !isPostgresUniqueConstraintViolation(
          error,
          POSTGRES_CONSTRAINTS.WAGER_TRANSACTION_IDEMPOTENCY_KEY,
        )
      ) {
        throw error;
      }

      throw new IdempotencyKeyAlreadyExistsError(
        SYSTEM_MESSAGES.PERSISTENCE.IDEMPOTENCY_KEY_ALREADY_EXISTS,
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
}
