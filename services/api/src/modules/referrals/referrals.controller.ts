import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { UserRole } from '@local-office/db';

import { Roles } from '../auth/auth.decorators';

import { CreateReferralDto } from './dto/create-referral.dto';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  create(@Body() dto: CreateReferralDto) {
    return this.referralsService.create(dto);
  }
}
