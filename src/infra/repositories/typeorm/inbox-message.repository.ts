import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import InboxMessage from '../../../domain/entities/inbox-message.entity';
import InboxMessageRepositoryInterface from '../../../domain/repositories/inbox-message-repository.interface';
import InboxMessageMapper from '../../mappers/inbox-message.mapper';
import { InboxMessageModel } from '../../models/inbox-message.model';

export const INBOX_MESSAGE_REPOSITORY = Symbol('INBOX_MESSAGE_REPOSITORY');

@Injectable()
export default class InboxMessageRepository implements InboxMessageRepositoryInterface {
  constructor(
    @InjectRepository(InboxMessageModel)
    private readonly repository: Repository<InboxMessageModel>,
  ) {}

  withTransaction(manager: EntityManager): InboxMessageRepositoryInterface {
    return new InboxMessageRepository(manager.getRepository(InboxMessageModel));
  }

  async findById(id: string): Promise<InboxMessage | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? InboxMessageMapper.toEntity(model) : null;
  }

  async create(entity: InboxMessage): Promise<void> {
    await this.repository.save(InboxMessageMapper.toPersistence(entity));
  }
}
