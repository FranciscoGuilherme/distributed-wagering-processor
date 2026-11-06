import { Body, Controller, Post } from '@nestjs/common';
import { CreateWalletDto } from '../../application/dtos/wager-operation.dto';
import CreateWalletUseCase from '../../application/usecases/create-wallet.usecase';

@Controller('wallets')
export class WalletsController {
  constructor(private readonly createWallet: CreateWalletUseCase) {}

  @Post()
  async create(@Body() body: CreateWalletDto) {
    return this.createWallet.execute({
      playerId: body.playerId,
      initialBalance: {
        amount: body.initialBalance.amount,
        currency: body.initialBalance.currency,
      },
    });
  }
}
