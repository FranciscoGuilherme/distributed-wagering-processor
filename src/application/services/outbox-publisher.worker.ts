import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type OutboxMessageRepositoryInterface from '../../domain/repositories/outbox-message-repository.interface';
import { OUTBOX_MESSAGE_REPOSITORY } from '../../infra/repositories/typeorm/outbox-message.repository';
import { SQS_CLIENT } from './sqs-client';

@Injectable()
export default class OutboxPublisherWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxPublisherWorker.name);
  private stopping = false;
  private loop?: Promise<void>;

  constructor(
    private readonly config: ConfigService,
    @Inject(OUTBOX_MESSAGE_REPOSITORY)
    private readonly outbox: OutboxMessageRepositoryInterface,
    @Inject(SQS_CLIENT) private readonly sqs: SQSClient,
  ) {}

  onModuleInit(): void {
    if (this.config.get('OUTBOX_PUBLISHER_ENABLED') !== 'true') {
      return;
    }
    if (!this.config.get<string>('SQS_OUTBOX_QUEUE_URL')) {
      throw new Error(
        'SQS_OUTBOX_QUEUE_URL is required when the outbox publisher is enabled',
      );
    }
    this.readInteger('OUTBOX_BATCH_SIZE', 10, 1, 10);
    this.readInteger('OUTBOX_CLAIM_LEASE_MS', 60000, 1000, 900000);
    this.loop = this.publishPending();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    await this.loop;
  }

  private async publishPending(): Promise<void> {
    const queueUrl = this.config.getOrThrow<string>('SQS_OUTBOX_QUEUE_URL');
    const batchSize = this.readInteger('OUTBOX_BATCH_SIZE', 10, 1, 10);
    const leaseMs = this.readInteger('OUTBOX_CLAIM_LEASE_MS', 60000, 1000, 900000);

    while (!this.stopping) {
      try {
        const events = await this.outbox.claimPendingBatch(batchSize, leaseMs);
        if (events.length === 0) {
          await this.pause(1000);
          continue;
        }

        for (const event of events) {
          try {
            await this.sqs.send(
              new SendMessageCommand({
                QueueUrl: queueUrl,
                MessageGroupId: event.aggregateId,
                MessageDeduplicationId: event.id,
                MessageBody: JSON.stringify({
                  eventId: event.id,
                  eventType: event.eventType,
                  aggregateId: event.aggregateId,
                  occurredAt: event.occurredAt.toISOString(),
                  version: 1,
                  data: event.payload,
                }),
              }),
            );
            await this.outbox.markPublished(event.id, event.claimToken);
          } catch (error) {
            const retrySeconds = Math.min(2 ** Math.min(event.attempts, 8), 300);
            await this.outbox
              .scheduleRetry(
                event.id,
                event.claimToken,
                new Date(Date.now() + retrySeconds * 1000),
              )
              .catch((retryError: unknown) => {
                this.logger.error(
                  `Could not schedule outbox retry for ${event.id}: ${this.errorMessage(retryError)}`,
                );
              });
            this.logger.error(
              `Outbox event ${event.id} remains pending: ${this.errorMessage(error)}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Outbox polling failed; the lease will permit recovery: ${this.errorMessage(error)}`,
        );
        await this.pause(1000);
      }
    }
  }

  private readInteger(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number {
    const value = Number(this.config.get(key) ?? fallback);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`);
    }
    return value;
  }

  private async pause(milliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
