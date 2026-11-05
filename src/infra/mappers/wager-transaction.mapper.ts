import WagerTransaction from '../../domain/entities/wager-transaction.entity';
import { WagerTransactionModel } from '../models/wager-transaction.model';

export default class WagerTransactionMapper {
  static toEntity(model: WagerTransactionModel): WagerTransaction {
    return new WagerTransaction({
      providerId: model.providerId,
      externalTransactionId: model.externalTransactionId,
      idempotencyKey: model.idempotencyKey,
      payloadHash: model.payloadHash,
      walletId: model.walletId,
      playerId: model.playerId,
      roundId: model.roundId,
      gameId: model.gameId,
      kind: model.kind,
      money: {
        amount: model.amount,
        currency: model.currency,
      },
      referenceExternalTransactionId:
        model.referenceExternalTransactionId ?? undefined,
      createdAt: model.createdAt,
      status: model.status,
      referenceTransactionId: model.referenceTransactionId ?? undefined,
      failureCode: model.failureCode ?? undefined,
      processedAt: model.processedAt ?? undefined,
      resultBalance:
        model.resultBalanceAmount !== null &&
        model.resultBalanceCurrency !== null
          ? {
              amount: model.resultBalanceAmount,
              currency: model.resultBalanceCurrency,
            }
          : undefined,
    }, model.id);
  }

  static toPersistence(entity: WagerTransaction): WagerTransactionModel {
    return {
      id: entity.id,
      providerId: entity.providerId,
      externalTransactionId: entity.externalTransactionId,
      idempotencyKey: entity.idempotencyKey,
      payloadHash: entity.payloadHash,
      walletId: entity.walletId,
      playerId: entity.playerId,
      roundId: entity.roundId,
      gameId: entity.gameId,
      kind: entity.kind,
      amount: entity.money.value.amount.toString(),
      currency: entity.money.value.currency,
      referenceExternalTransactionId:
        entity.referenceExternalTransactionId ?? null,
      status: entity.status,
      createdAt: entity.createdAt,
      referenceTransactionId: entity.referenceTransactionId ?? null,
      failureCode: entity.failureCode ?? null,
      processedAt: entity.processedAt ?? null,
      resultBalanceAmount: entity.resultBalance?.amount ?? null,
      resultBalanceCurrency: entity.resultBalance?.currency ?? null,
    };
  }
}
