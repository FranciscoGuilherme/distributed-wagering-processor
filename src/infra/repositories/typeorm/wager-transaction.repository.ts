import { InjectRepository } from '@nestjs/typeorm';
import WagerTransaction from '../../../domain/entities/wager-transaction.entity';
import WagerTransactionRepositoryInterface from '../../../domain/repositories/wager-transaction-repository.interface';
import WagerTransactionMapper from '../../mappers/wager-transaction.mapper';
import { WagerTransactionModel } from '../../models/wager-transaction.model';
import { Repository } from 'typeorm';

export default class WagerTransactionRepository implements WagerTransactionRepositoryInterface {
  constructor(
    @InjectRepository(WagerTransactionModel)
    private readonly repository: Repository<WagerTransactionModel>,
  ) {}

  async findById(id: string): Promise<WagerTransaction | null> {
    const model = this.repository.findOneBy({ id });
    if (model instanceof WagerTransactionModel) {
      return WagerTransactionMapper.toEntity(model);
    }
    return null;
  }

  async create(entity: WagerTransaction): Promise<WagerTransaction> {
    const model = await this.repository.save(
      WagerTransactionMapper.toPersistence(entity),
    );
    return WagerTransactionMapper.toEntity(model);
  }
}
