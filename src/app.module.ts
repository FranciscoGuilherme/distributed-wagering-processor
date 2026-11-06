import { SQSClient } from '@aws-sdk/client-sqs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  UNIT_OF_WORK,
  type UnitOfWork,
} from './application/ports/unit-of-work.interface';
import CreateWalletUseCase from './application/usecases/create-wallet.usecase';
import ProcessKindBetUseCase from './application/usecases/process-kind-bet.usecase';
import ProcessKindLossUseCase from './application/usecases/process-kind-loss.usecase';
import ProcessKindRefoundUseCase from './application/usecases/process-kind-refound.usecase';
import ProcessKindRollbackUseCase from './application/usecases/process-kind-rollback.usecase';
import ProcessKindWinUseCase from './application/usecases/process-kind-win.usecase';
import ProcessOperationUseCase from './application/usecases/process-operation.usecase';
import type InboxMessageRepositoryInterface from './domain/repositories/inbox-message-repository.interface';
import { WageringController } from './infra/controllers/wagering.controller';
import { WalletsController } from './infra/controllers/wallets.controller';
import OutboxPublisherWorker from './infra/messaging/sqs/outbox-publisher.worker';
import QueueManagerService from './infra/messaging/sqs/queue-manager.service';
import { SQS_CLIENT } from './infra/messaging/sqs/sqs-client';
import SqsConsumerWorker from './infra/messaging/sqs/sqs-consumer.worker';
import { InboxMessageModel } from './infra/models/inbox-message.model';
import { OutboxMessageModel } from './infra/models/outbox-message.model';
import { WagerTransactionModel } from './infra/models/wager-transaction.model';
import WalletLedgerEntryModel from './infra/models/wallet-ledger-entry.model';
import WalletModel from './infra/models/wallet.model';
import InboxMessageRepository, {
  INBOX_MESSAGE_REPOSITORY,
} from './infra/repositories/typeorm/inbox-message.repository';
import OutboxMessageRepository, {
  OUTBOX_MESSAGE_REPOSITORY,
} from './infra/repositories/typeorm/outbox-message.repository';
import WagerTransactionRepository, {
  WAGER_TRANSACTION_REPOSITORY,
} from './infra/repositories/typeorm/wager-transaction.repository';
import WalletLedgerEntryRepository, {
  WALLET_LEDGER_ENTRY_REPOSITORY,
} from './infra/repositories/typeorm/wallet-ledger-entry.repository';
import WalletRepository, {
  WALLET_REPOSITORY,
} from './infra/repositories/typeorm/wallet.repository';
import { TypeOrmUnitOfWork } from './infra/repositories/unit-of-work';

@Module({
  controllers: [WageringController, WalletsController],
  providers: [
    TypeOrmUnitOfWork,
    {
      provide: UNIT_OF_WORK,
      useExisting: TypeOrmUnitOfWork,
    },
    SqsConsumerWorker,
    OutboxPublisherWorker,
    {
      provide: CreateWalletUseCase,
      inject: [UNIT_OF_WORK],
      useFactory: (uow: UnitOfWork) => new CreateWalletUseCase(uow),
    },
    {
      provide: ProcessKindBetUseCase,
      useFactory: () => new ProcessKindBetUseCase(),
    },
    {
      provide: ProcessKindWinUseCase,
      useFactory: () => new ProcessKindWinUseCase(),
    },
    {
      provide: ProcessKindLossUseCase,
      useFactory: () => new ProcessKindLossUseCase(),
    },
    {
      provide: ProcessKindRollbackUseCase,
      useFactory: () => new ProcessKindRollbackUseCase(),
    },
    {
      provide: ProcessKindRefoundUseCase,
      useFactory: () => new ProcessKindRefoundUseCase(),
    },
    {
      provide: ProcessOperationUseCase,
      inject: [
        UNIT_OF_WORK,
        INBOX_MESSAGE_REPOSITORY,
        ProcessKindBetUseCase,
        ProcessKindWinUseCase,
        ProcessKindLossUseCase,
        ProcessKindRefoundUseCase,
        ProcessKindRollbackUseCase,
      ],
      useFactory: (
        uow: UnitOfWork,
        inbox: InboxMessageRepositoryInterface,
        bet: ProcessKindBetUseCase,
        win: ProcessKindWinUseCase,
        loss: ProcessKindLossUseCase,
        refund: ProcessKindRefoundUseCase,
        rollback: ProcessKindRollbackUseCase,
      ) =>
        new ProcessOperationUseCase(
          uow,
          inbox,
          bet,
          win,
          loss,
          refund,
          rollback,
        ),
    },
    {
      provide: QueueManagerService,
      inject: [ProcessOperationUseCase],
      useFactory: (processOperation: ProcessOperationUseCase) =>
        new QueueManagerService(processOperation),
    },
    WagerTransactionRepository,
    InboxMessageRepository,
    OutboxMessageRepository,
    WalletLedgerEntryRepository,
    WalletRepository,
    {
      provide: WAGER_TRANSACTION_REPOSITORY,
      useExisting: WagerTransactionRepository,
    },
    {
      provide: INBOX_MESSAGE_REPOSITORY,
      useExisting: InboxMessageRepository,
    },
    {
      provide: OUTBOX_MESSAGE_REPOSITORY,
      useExisting: OutboxMessageRepository,
    },
    {
      provide: WALLET_LEDGER_ENTRY_REPOSITORY,
      useExisting: WalletLedgerEntryRepository,
    },
    {
      provide: WALLET_REPOSITORY,
      useExisting: WalletRepository,
    },
    {
      provide: SQS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
        return new SQSClient({
          region: config.get<string>('AWS_REGION') ?? 'us-east-1',
          endpoint: config.get<string>('SQS_ENDPOINT') || undefined,
          credentials:
            accessKeyId && secretAccessKey
              ? { accessKeyId, secretAccessKey }
              : undefined,
        });
      },
    },
  ],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forFeature([
      WagerTransactionModel,
      InboxMessageModel,
      OutboxMessageModel,
      WalletLedgerEntryModel,
      WalletModel,
    ]),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
      }),
    }),
  ],
})
export class AppModule {}
