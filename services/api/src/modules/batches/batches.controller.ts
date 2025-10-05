import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { UserRole } from '@local-office/db';

import { Roles } from '../auth/auth.decorators';

import { BatchesService } from './batches.service';

@Controller('batches')
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get(':id/manifest')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  manifest(@Param('id') id: string) {
    return this.batchesService.manifest(id);
  }

  @Post(':id/labels')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.ADMIN)
  requestLabels(@Param('id') id: string) {
    return this.batchesService.requestLabels(id);
  }

  @Get(':id/labels')
  @Roles(UserRole.PROVIDER, UserRole.ADMIN)
  getLabels(@Param('id') id: string) {
    return this.batchesService.getLabels(id);
  }
}
