import { IsISO8601, IsString } from 'class-validator';

export class QuoteDeliveryDto {
  @IsString()
  adapter!: string;

  @IsString()
  pickupAddress!: string;

  @IsString()
  dropoffAddress!: string;

  @IsISO8601()
  readyAt!: string;

  @IsString()
  reference!: string;
}
