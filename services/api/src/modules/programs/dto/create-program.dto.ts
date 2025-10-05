import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested
} from 'class-validator';

export class ProgramSlotDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsNotEmpty()
  @IsUUID()
  providerId!: string;

  @IsNotEmpty()
  @IsString()
  serviceDate!: string;

  @IsNotEmpty()
  @IsString()
  windowStart!: string;

  @IsNotEmpty()
  @IsString()
  windowEnd!: string;

  @IsNotEmpty()
  @IsString()
  cutoffAt!: string;
}

export class CreateProgramDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsNotEmpty()
  @IsUUID()
  orgId!: string;

  @IsNotEmpty()
  @IsUUID()
  siteId!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsString()
  cadence!: string;

  @IsNotEmpty()
  @IsString()
  orderingWindow!: string;

  @IsOptional()
  @IsInt()
  cutoffHours?: number;

  @IsOptional()
  @IsBoolean()
  loyaltyRequired?: boolean;

  @IsOptional()
  subsidyRules?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgramSlotDto)
  slots!: ProgramSlotDto[];
}
