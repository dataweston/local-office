import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { IncidentCategory, IncidentSeverity } from '@local-office/db';

export class CreateIncidentDto {
  @IsOptional()
  @IsUUID()
  orgId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsOptional()
  @IsUUID()
  deliveryJobId?: string;

  @IsOptional()
  @IsUUID()
  reporterId?: string;

  @IsEnum(IncidentCategory)
  category!: IncidentCategory;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsOptional()
  attachments?: unknown;

  @IsOptional()
  @IsObject()
  resolution?: Record<string, unknown>;
}
