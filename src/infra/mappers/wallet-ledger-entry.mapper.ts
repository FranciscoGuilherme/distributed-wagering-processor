import WalletLedgerEntry from '../../domain/entities/wallet-ledger-entry.entity';
import WalletLedgerEntryModel from '../models/wallet-ledger-entry.model';

export default class WalletLedgerEntryMapper {
  static toEntity(model: WalletLedgerEntryModel): WalletLedgerEntry {
    return new WalletLedgerEntry(
      {
        walletId: model.walletId,
        transactionId: model.transactionId,
        direction: model.direction,
        money: {
          amount: model.amount,
          currency: model.currency,
        },
        balanceBefore: {
          amount: model.balanceBeforeAmount,
          currency: model.balanceBeforeCurrency,
        },
        balanceAfter: {
          amount: model.balanceAfterAmount,
          currency: model.balanceAfterCurrency,
        },
        createdAt: model.createdAt,
      },
      model.id,
    );
  }

  static toPersistence(entity: WalletLedgerEntry): WalletLedgerEntryModel {
    return {
      id: entity.id,
      walletId: entity.walletId,
      transactionId: entity.transactionId,
      direction: entity.direction,
      amount: entity.money.value.amount.toString(),
      currency: entity.money.value.currency,
      balanceBeforeAmount: entity.balanceBefore.value.amount.toString(),
      balanceBeforeCurrency: entity.balanceBefore.value.currency,
      balanceAfterAmount: entity.balanceAfter.value.amount.toString(),
      balanceAfterCurrency: entity.balanceAfter.value.currency,
      createdAt: entity.createdAt,
    };
  }
}
