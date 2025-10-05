import { Injectable } from '@nestjs/common';

import { createIdempotencyKey } from '@local-office/lib';

import { PrismaService } from '../prisma/prisma.service';
import { CreateReferralDto } from './dto/create-referral.dto';

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateReferralDto) {
    const code = dto.code ?? createIdempotencyKey('referral');

    return this.prisma.referral.create({
      data: {
        code,
        referrerOrgId: dto.referrerOrgId,
        referrerAdminId: dto.referrerAdminId,
        referredOrgId: dto.referredOrgId,
        metadata: dto.metadata ?? undefined
      }
    });
  }
}
