import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import ProcessBet from './application/usecases/process-operation.usecase';
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
  providers: [
    UnitOfWork,
    ProcessBet,
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
