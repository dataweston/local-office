import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@local-office/db';

import { Roles } from '../auth/auth.decorators';

import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  list(@Query('org') orgId: string) {
    return this.invoicesService.listByOrg(orgId);
  }
}
