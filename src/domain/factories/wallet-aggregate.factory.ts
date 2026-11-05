import WalletAggregate, { WalletProps } from '../entities/wallet.aggregate';

export default class WalletAggregateFactory {
  static create(props: WalletProps): WalletAggregate {
    const entity = new WalletAggregate(props);
    entity.validate();
    return entity;
  }

  static rehydrate(props: WalletProps): WalletAggregate {
    return new WalletAggregate(props);
  }
}
