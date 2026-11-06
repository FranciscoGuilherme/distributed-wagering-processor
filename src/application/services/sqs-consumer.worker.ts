import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import InvalidQueueMessageError from '../../domain/@shared/errors/invalid-queue-message.error';
import QueueManagerService from './queue-manager.service';
import { SQS_CLIENT } from './sqs-client';

@Injectable()
export default class SqsConsumerWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SqsConsumerWorker.name);
  private stopping = false;
  private loop?: Promise<void>;

  constructor(
    private readonly config: ConfigService,
    private readonly queueManager: QueueManagerService,
    @Inject(SQS_CLIENT) private readonly sqs: SQSClient,
  ) {}

  onModuleInit(): void {
    if (this.config.get('SQS_CONSUMER_ENABLED') !== 'true') {
      return;
    }
    if (!this.config.get<string>('SQS_OPERATION_QUEUE_URL')) {
      throw new Error(
        'SQS_OPERATION_QUEUE_URL is required when the SQS consumer is enabled',
      );
    }
    this.readInteger('SQS_LONG_POLL_SECONDS', 20, 0, 20);
    this.readInteger('SQS_VISIBILITY_TIMEOUT_SECONDS', 60, 1, 43200);
    this.loop = this.consume();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    await this.loop;
  }

  private async consume(): Promise<void> {
    const queueUrl = this.config.getOrThrow<string>('SQS_OPERATION_QUEUE_URL');
    const waitTime = this.readInteger('SQS_LONG_POLL_SECONDS', 20, 0, 20);
    const visibilityTimeout = this.readInteger(
      'SQS_VISIBILITY_TIMEOUT_SECONDS',
      60,
      1,
      43200,
    );

    while (!this.stopping) {
      let messages;
      try {
        const response = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: waitTime,
            VisibilityTimeout: visibilityTimeout,
            MessageSystemAttributeNames: ['ApproximateReceiveCount'],
          }),
        );
        messages = response.Messages ?? [];
      } catch (error) {
        this.logger.error(
          `SQS receive failed; polling will resume: ${this.errorMessage(error)}`,
        );
        await this.pause(1000);
        continue;
      }

      const message = messages[0];
      if (!message || this.stopping) {
        continue;
      }

      const receiptHandle = message.ReceiptHandle;
      const body = message.Body;
      if (!receiptHandle || !body) {
        this.logger.warn(
          'SQS returned a message without body or receipt handle',
        );
        continue;
      }

      try {
        let envelope: unknown;
        try {
          envelope = JSON.parse(body) as unknown;
        } catch {
          throw new InvalidQueueMessageError('Queue message body is not JSON');
        }

        await this.queueManager.processQueueMessage(envelope);
        await this.sqs.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle,
          }),
        );
      } catch (error) {
        this.logger.warn(
          `SQS message was not acknowledged: ${this.errorMessage(error)}`,
        );
        if (!(error instanceof InvalidQueueMessageError)) {
          await this.deferRetry(
            queueUrl,
            receiptHandle,
            Number(message.Attributes?.ApproximateReceiveCount ?? 1),
          );
        }
      }
    }
  }

  private async deferRetry(
    queueUrl: string,
    receiptHandle: string,
    receiveCount: number,
  ): Promise<void> {
    const delay = Math.min(2 ** Math.min(receiveCount, 8), 300);
    try {
      await this.sqs.send(
        new ChangeMessageVisibilityCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: receiptHandle,
          VisibilityTimeout: delay,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Could not extend SQS retry visibility: ${this.errorMessage(error)}`,
      );
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
      throw new Error(
        `${key} must be an integer between ${minimum} and ${maximum}`,
      );
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
