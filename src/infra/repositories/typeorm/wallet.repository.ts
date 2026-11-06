import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import WalletAlreadyExistsError from '../../../domain/@shared/errors/wallet-already-exists.error';
import WalletAggregate from '../../../domain/entities/wallet.aggregate';
import WalletRepositoryInterface from '../../../domain/repositories/wallet-repository.interface';
import { SYSTEM_MESSAGES } from '../../../shared/constants/system-messages';
import {
  isPostgresUniqueConstraintViolation,
  POSTGRES_CONSTRAINTS,
} from '../../database/postgres-errors';
import WalletMapper from '../../mappers/wallet.mapper';
import WalletModel from '../../models/wallet.model';

export const WALLET_REPOSITORY = Symbol('WALLET_REPOSITORY');

@Injectable()
export default class WalletRepository implements WalletRepositoryInterface {
  constructor(
    @InjectRepository(WalletModel)
    private readonly repository: Repository<WalletModel>,
  ) {}

  withTransaction(manager: EntityManager): WalletRepositoryInterface {
    return new WalletRepository(manager.getRepository(WalletModel));
  }

  async findById(id: string): Promise<WalletAggregate | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? WalletMapper.toEntity(model) : null;
  }

  async findByIdForUpdate(id: string): Promise<WalletAggregate | null> {
    const model = await this.repository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return model ? WalletMapper.toEntity(model) : null;
  }

  async findByPlayerAndCurrency(
    playerId: string,
    currency: string,
  ): Promise<WalletAggregate | null> {
    const model = await this.repository.findOneBy({ playerId, currency });
    return model ? WalletMapper.toEntity(model) : null;
  }

  async create(wallet: WalletAggregate): Promise<void> {
    await this.repository.save(WalletMapper.toPersistence(wallet));
  }

  async createNew(wallet: WalletAggregate): Promise<void> {
    try {
      await this.repository.insert(WalletMapper.toPersistence(wallet));
    } catch (error) {
      if (
        !isPostgresUniqueConstraintViolation(
          error,
          POSTGRES_CONSTRAINTS.WALLET_PLAYER_CURRENCY,
        )
      ) {
        throw error;
      }

      throw new WalletAlreadyExistsError(
        SYSTEM_MESSAGES.PERSISTENCE.WALLET_ALREADY_EXISTS,
      );
    }
  }
}
