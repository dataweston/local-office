import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class ConfirmOrderDto {
  @IsOptional()
  @IsString()
  paymentIntentId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tipOverride?: number;

  @IsOptional()
  @IsIn(['CARD', 'ACH'])
  paymentMethod?: 'CARD' | 'ACH';
}
