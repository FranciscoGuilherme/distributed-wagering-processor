import WalletLedgerEntry, {
  WalletLedgerEntryProps,
} from '../entities/wallet-ledger-entry.entity';

export default class WalletLedgerEntryFactory {
  static create(props: WalletLedgerEntryProps): WalletLedgerEntry {
    const entity = new WalletLedgerEntry(props);
    entity.validate();
    return entity;
  }

  static rehydrate(props: WalletLedgerEntryProps): WalletLedgerEntry {
    return new WalletLedgerEntry(props);
  }
}
