import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import WalletLedgerEntryInterface from '../../../domain/repositories/wallet-ledger-entry.interface';
import WalletLedgerEntryModel from '../../models/wallet-ledger-entry.model';
import { InjectRepository } from '@nestjs/typeorm';
import WalletLedgerEntry from '../../../domain/entities/wallet-ledger-entry.entity';
import WalletLedgerEntryMapper from '../../mappers/wallet-ledger-entry.mapper';

export const WALLET_LEDGER_ENTRY_REPOSITORY = Symbol(
  'WALLET_LEDGER_ENTRY_REPOSITORY',
);

@Injectable()
export default class WalletLedgerEntryRepository implements WalletLedgerEntryInterface {
  constructor(
    @InjectRepository(WalletLedgerEntryModel)
    private readonly repository: Repository<WalletLedgerEntryModel>,
  ) {}

  withTransaction(manager: EntityManager): WalletLedgerEntryInterface {
    return new WalletLedgerEntryRepository(
      manager.getRepository(WalletLedgerEntryModel),
    );
  }

  async findById(id: string): Promise<WalletLedgerEntry | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? WalletLedgerEntryMapper.toEntity(model) : null;
  }

  async create(entity: WalletLedgerEntry): Promise<void> {
    await this.repository.save(WalletLedgerEntryMapper.toPersistence(entity));
  }
}
