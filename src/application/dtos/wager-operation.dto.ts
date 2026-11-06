import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const EXTERNAL_TRANSACTION_KINDS = [
  'BET',
  'WIN',
  'LOSS',
  'REFUND',
  'ROLLBACK',
] as const;

export class MoneyDto {
  @IsString()
  @Matches(/^(?=.*[1-9])\d{1,16}(?:\.\d{1,2})?$/)
  amount!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;
}

export class InitialBalanceDto {
  @IsString()
  @Matches(/^\d{1,16}(?:\.\d{1,2})?$/)
  amount!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;
}

export class WagerOperationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  providerId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  externalTransactionId!: string;

  @IsUUID()
  playerId!: string;

  @IsUUID()
  walletId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  roundId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  gameId!: string;

  @IsString()
  @IsIn([...EXTERNAL_TRANSACTION_KINDS])
  kind!: (typeof EXTERNAL_TRANSACTION_KINDS)[number];

  @ValidateNested()
  @Type(() => MoneyDto)
  @IsDefined()
  money!: MoneyDto;

  @ValidateIf(
    (operation: WagerOperationDto) =>
      operation.referenceExternalTransactionId !== undefined ||
      operation.kind === 'REFUND' ||
      operation.kind === 'ROLLBACK',
  )
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  referenceExternalTransactionId?: string;
}

export class CreateWalletDto {
  @IsUUID()
  playerId!: string;

  @ValidateNested()
  @Type(() => InitialBalanceDto)
  @IsDefined()
  initialBalance!: InitialBalanceDto;
}
