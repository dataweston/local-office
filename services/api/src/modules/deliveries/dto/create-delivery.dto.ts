import { IsOptional, IsString } from 'class-validator';

import { QuoteDeliveryDto } from './quote-delivery.dto';

export class CreateDeliveryDto extends QuoteDeliveryDto {
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}
