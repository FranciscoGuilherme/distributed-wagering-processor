import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import OutboxMessage from '../../../domain/entities/outbox-message.entity';
import OutboxMessageRepositoryInterface from '../../../domain/repositories/outbox-message-repository.interface';
import OutboxMessageMapper from '../../mappers/outbox-message.mapper';
import { OutboxMessageModel } from '../../models/outbox-message.model';

export const OUTBOX_MESSAGE_REPOSITORY = Symbol('OUTBOX_MESSAGE_REPOSITORY');

@Injectable()
export default class OutboxMessageRepository implements OutboxMessageRepositoryInterface {
  constructor(
    @InjectRepository(OutboxMessageModel)
    private readonly repository: Repository<OutboxMessageModel>,
  ) {}

  withTransaction(manager: EntityManager): OutboxMessageRepositoryInterface {
    return new OutboxMessageRepository(manager.getRepository(OutboxMessageModel));
  }

  async findById(id: string): Promise<OutboxMessage | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? OutboxMessageMapper.toEntity(model) : null;
  }

  async create(entity: OutboxMessage): Promise<void> {
    await this.repository.save(OutboxMessageMapper.toPersistence(entity));
  }
}
