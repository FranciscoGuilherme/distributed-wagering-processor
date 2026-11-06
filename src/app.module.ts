import { SQSClient } from '@aws-sdk/client-sqs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import CreateWalletUseCase from './application/usecases/create-wallet.usecase';
import ProcessKindBetUseCase from './application/usecases/process-kind-bet.usecase';
import ProcessKindLossUseCase from './application/usecases/process-kind-loss.usecase';
import ProcessKindRefoundUseCase from './application/usecases/process-kind-refound.usecase';
import ProcessKindRollbackUseCase from './application/usecases/process-kind-rollback.usecase';
import ProcessKindWinUseCase from './application/usecases/process-kind-win.usecase';
import ProcessOperationUseCase from './application/usecases/process-operation.usecase';
import type InboxMessageRepositoryInterface from './domain/repositories/inbox-message-repository.interface';
import type OutboxMessageRepositoryInterface from './domain/repositories/outbox-message-repository.interface';
import type WagerTransactionRepositoryInterface from './domain/repositories/wager-transaction-repository.interface';
import type WalletLedgerEntryInterface from './domain/repositories/wallet-ledger-entry.interface';
import type WalletRepositoryInterface from './domain/repositories/wallet-repository.interface';
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
import { UnitOfWork } from './infra/repositories/unit-of-work';

@Module({
  controllers: [WageringController, WalletsController],
  providers: [
    UnitOfWork,
    SqsConsumerWorker,
    OutboxPublisherWorker,
    {
      provide: CreateWalletUseCase,
      inject: [
        UnitOfWork,
        WALLET_REPOSITORY,
        WAGER_TRANSACTION_REPOSITORY,
        WALLET_LEDGER_ENTRY_REPOSITORY,
        OUTBOX_MESSAGE_REPOSITORY,
      ],
      useFactory: (
        uow: UnitOfWork,
        wallets: WalletRepositoryInterface,
        transactions: WagerTransactionRepositoryInterface,
        ledger: WalletLedgerEntryInterface,
        outbox: OutboxMessageRepositoryInterface,
      ) => new CreateWalletUseCase(uow, wallets, transactions, ledger, outbox),
    },
    {
      provide: ProcessKindBetUseCase,
      inject: [
        WALLET_REPOSITORY,
        WALLET_LEDGER_ENTRY_REPOSITORY,
        WAGER_TRANSACTION_REPOSITORY,
        OUTBOX_MESSAGE_REPOSITORY,
      ],
      useFactory: (
        wallets: WalletRepositoryInterface,
        ledger: WalletLedgerEntryInterface,
        transactions: WagerTransactionRepositoryInterface,
        outbox: OutboxMessageRepositoryInterface,
      ) => new ProcessKindBetUseCase(wallets, ledger, transactions, outbox),
    },
    {
      provide: ProcessKindWinUseCase,
      inject: [
        WALLET_REPOSITORY,
        WALLET_LEDGER_ENTRY_REPOSITORY,
        WAGER_TRANSACTION_REPOSITORY,
        OUTBOX_MESSAGE_REPOSITORY,
      ],
      useFactory: (
        wallets: WalletRepositoryInterface,
        ledger: WalletLedgerEntryInterface,
        transactions: WagerTransactionRepositoryInterface,
        outbox: OutboxMessageRepositoryInterface,
      ) => new ProcessKindWinUseCase(wallets, ledger, transactions, outbox),
    },
    {
      provide: ProcessKindLossUseCase,
      inject: [
        WALLET_REPOSITORY,
        WAGER_TRANSACTION_REPOSITORY,
        OUTBOX_MESSAGE_REPOSITORY,
      ],
      useFactory: (
        wallets: WalletRepositoryInterface,
        transactions: WagerTransactionRepositoryInterface,
        outbox: OutboxMessageRepositoryInterface,
      ) => new ProcessKindLossUseCase(wallets, transactions, outbox),
    },
    {
      provide: ProcessKindRollbackUseCase,
      inject: [
        WALLET_REPOSITORY,
        WALLET_LEDGER_ENTRY_REPOSITORY,
        WAGER_TRANSACTION_REPOSITORY,
        OUTBOX_MESSAGE_REPOSITORY,
      ],
      useFactory: (
        wallets: WalletRepositoryInterface,
        ledger: WalletLedgerEntryInterface,
        transactions: WagerTransactionRepositoryInterface,
        outbox: OutboxMessageRepositoryInterface,
      ) =>
        new ProcessKindRollbackUseCase(wallets, ledger, transactions, outbox),
    },
    {
      provide: ProcessKindRefoundUseCase,
      inject: [
        WALLET_REPOSITORY,
        WALLET_LEDGER_ENTRY_REPOSITORY,
        WAGER_TRANSACTION_REPOSITORY,
        OUTBOX_MESSAGE_REPOSITORY,
      ],
      useFactory: (
        wallets: WalletRepositoryInterface,
        ledger: WalletLedgerEntryInterface,
        transactions: WagerTransactionRepositoryInterface,
        outbox: OutboxMessageRepositoryInterface,
      ) => new ProcessKindRefoundUseCase(wallets, ledger, transactions, outbox),
    },
    {
      provide: ProcessOperationUseCase,
      inject: [
        UnitOfWork,
        WAGER_TRANSACTION_REPOSITORY,
        INBOX_MESSAGE_REPOSITORY,
        ProcessKindBetUseCase,
        ProcessKindWinUseCase,
        ProcessKindLossUseCase,
        ProcessKindRefoundUseCase,
        ProcessKindRollbackUseCase,
      ],
      useFactory: (
        uow: UnitOfWork,
        transactions: WagerTransactionRepositoryInterface,
        inbox: InboxMessageRepositoryInterface,
        bet: ProcessKindBetUseCase,
        win: ProcessKindWinUseCase,
        loss: ProcessKindLossUseCase,
        refund: ProcessKindRefoundUseCase,
        rollback: ProcessKindRollbackUseCase,
      ) =>
        new ProcessOperationUseCase(
          uow,
          transactions,
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
