import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import WalletAggregate from '../../../domain/entities/wallet.aggregate';
import WalletRepositoryInterface from '../../../domain/repositories/wallet-repository.interface';
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

  async create(wallet: WalletAggregate): Promise<void> {
    await this.repository.save(WalletMapper.toPersistence(wallet));
  }
}
