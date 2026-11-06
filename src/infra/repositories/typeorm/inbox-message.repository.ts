import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import InboxMessageAlreadyExistsError from '../../../domain/@shared/errors/inbox-message-already-exists.error';
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
      if (!this.isInboxUniqueViolation(error)) {
        throw error;
      }

      throw new InboxMessageAlreadyExistsError(
        'An inbox message with this consumer and message id already exists',
      );
    }
  }

  private isInboxUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as {
      code?: string;
      constraint?: string;
    };

    return (
      driverError.code === '23505' &&
      driverError.constraint === 'uq_inbox_messages_consumer_message'
    );
  }
}
