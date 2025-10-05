import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReferralDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsUUID()
  referrerOrgId?: string;

  @IsOptional()
  @IsUUID()
  referrerAdminId?: string;

  @IsOptional()
  @IsUUID()
  referredOrgId?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
