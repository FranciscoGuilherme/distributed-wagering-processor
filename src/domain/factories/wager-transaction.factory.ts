import WagerTransaction, {
  WagerTransactionProps,
} from '../entities/wager-transaction.entity';

export default class WagerTransactionFactory {
  static create(props: WagerTransactionProps): WagerTransaction {
    const entity = new WagerTransaction(props);
    entity.validate();
    return entity;
  }

  static rehydrate(props: WagerTransactionProps): WagerTransaction {
    return new WagerTransaction(props);
  }
}
