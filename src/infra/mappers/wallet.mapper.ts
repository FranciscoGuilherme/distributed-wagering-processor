import WalletAggregate from '../../domain/entities/wallet.aggregate';
import WalletModel from '../models/wallet.model';

export default class WalletMapper {
  static toEntity(model: WalletModel): WalletAggregate {
    return new WalletAggregate(
      {
        id: model.id,
        playerId: model.playerId,
        currency: model.currency,
        balance: {
          amount: model.balanceAmount,
          currency: model.currency,
        },
        version: model.version,
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
      },
      model.id,
    );
  }

  static toPersistence(entity: WalletAggregate): WalletModel {
    return {
      id: entity.id,
      playerId: entity.playerId,
      currency: entity.currency,
      balanceAmount: entity.balance.value.amount.toString(),
      version: entity.version,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
