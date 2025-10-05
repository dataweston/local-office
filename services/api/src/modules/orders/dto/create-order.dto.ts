import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  ValidateNested
} from 'class-validator';

class OrderItemDto {
  @IsNotEmpty()
  @IsUUID()
  skuId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(50)
  quantity: number = 1;

  @IsOptional()
  @IsObject()
  modifiers?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @IsNotEmpty()
  @IsUUID()
  userId!: string;

  @IsNotEmpty()
  @IsUUID()
  programSlotId!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(200)
  tip?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export { OrderItemDto };
