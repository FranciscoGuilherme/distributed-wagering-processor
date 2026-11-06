import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import InboxMessageAlreadyExistsError from '../../../domain/@shared/errors/inbox-message-already-exists.error';
import InboxMessage from '../../../domain/entities/inbox-message.entity';
import InboxMessageRepositoryInterface from '../../../domain/repositories/inbox-message-repository.interface';
import { SYSTEM_MESSAGES } from '../../../shared/constants/system-messages';
import {
  isPostgresUniqueConstraintViolation,
  POSTGRES_CONSTRAINTS,
} from '../../database/postgres-errors';
import InboxMessageMapper from '../../mappers/inbox-message.mapper';
import { InboxMessageModel } from '../../models/inbox-message.model';

export const INBOX_MESSAGE_REPOSITORY = Symbol('INBOX_MESSAGE_REPOSITORY');

@Injectable()
export default class InboxMessageRepository implements InboxMessageRepositoryInterface {
  constructor(
    @InjectRepository(InboxMessageModel)
    private readonly repository: Repository<InboxMessageModel>,
  ) {}

  async findById(id: string): Promise<InboxMessage | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? InboxMessageMapper.toEntity(model) : null;
  }

  async findByConsumerAndMessageId(
    consumerName: string,
    messageId: string,
  ): Promise<InboxMessage | null> {
    const model = await this.repository.findOneBy({ consumerName, messageId });
    return model ? InboxMessageMapper.toEntity(model) : null;
  }

  async create(entity: InboxMessage): Promise<void> {
    try {
      await this.repository.insert(InboxMessageMapper.toPersistence(entity));
    } catch (error) {
      if (
        !isPostgresUniqueConstraintViolation(
          error,
          POSTGRES_CONSTRAINTS.INBOX_CONSUMER_MESSAGE,
        )
      ) {
        throw error;
      }

      throw new InboxMessageAlreadyExistsError(
        SYSTEM_MESSAGES.PERSISTENCE.INBOX_MESSAGE_ALREADY_EXISTS,
      );
    }
  }
}
