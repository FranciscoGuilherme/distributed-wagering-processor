import { Injectable } from '@nestjs/common';

export type ProcessBetProps = {
  idempotencyKey: string;
  providerId: string;
  externalTransactionId: string;
  playerId: string; // uuid
  walletId: string; // uuid
  roundId: string;
  gameId: string;
  kind: string;
  money: {
    amount: string;
    currency: string;
  };
};

@Injectable()
export default class ProcessBet {
  constructor() {}

  async execute(props: ProcessBetProps): Promise<void> {
    // TODO: Criar ou localizar a WagerTransaction usando o provedor e o identificador externo.
    // TODO: Descobrir qual regra se aplica pelo tipo: uma aposta (BET), um prêmio (WIN), um estorno (REFUND) ou outra operação
    // TODO: Carregar a Wallet do jogador
    // TODO: Pedir à carteira para aplicar o efeito: uma aposta debita; um prêmio credita. A carteira protege o saldo e a moeda.
    // TODO: Registrar o resultado no ledger: valor, direção e saldos antes/depois
    // TODO: Atualizar a transação para indicar que foi processada ou rejeitada
  }
}

// WagerTransaction: o pedido recebido e seu estado de processamento.
// Wallet: o saldo e as regras para mudá-lo.
// WalletLedgerEntry: a evidência de cada mudança efetiva no saldo.
