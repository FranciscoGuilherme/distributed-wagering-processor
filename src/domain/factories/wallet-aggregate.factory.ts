import WalletAggregate, { WalletProps } from '../entities/wallet.aggregate';

export default class WalletAggregateFactory {
  static create(props: WalletProps): WalletAggregate {
    const entity = new WalletAggregate(props, props.id);
    entity.validate();
    return entity;
  }

  static rehydrate(props: WalletProps): WalletAggregate {
    return new WalletAggregate(props, props.id);
  }
}
