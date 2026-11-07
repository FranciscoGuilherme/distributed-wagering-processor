import { Type } from 'class-transformer';
import {
  Equals,
  IsDefined,
  IsObject,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { WagerTransactionOperationDto } from './wager-transaction-operation.dto';

export class WagerTransactionEnvelopeDto {
  @Equals('WagerTransactionRequested')
  type!: string;

  @IsString()
  @Matches(/\S/, { message: 'messageId must not be empty' })
  messageId!: string;

  @IsString()
  @Matches(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
    {
      message: 'occurredAt must be a valid ISO 8601 date',
    },
  )
  occurredAt!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => WagerTransactionOperationDto)
  data!: WagerTransactionOperationDto;
}
