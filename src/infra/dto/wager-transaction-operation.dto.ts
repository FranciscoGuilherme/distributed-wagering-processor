import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { WagerOperationDto } from '../../application/dtos/wager-operation.dto';

export class WagerTransactionOperationDto extends WagerOperationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^\S(?:[\s\S]*\S)?$/)
  idempotencyKey!: string;
}
