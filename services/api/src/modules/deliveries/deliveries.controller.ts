import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { UserRole } from '@local-office/db';

import { Roles } from '../auth/auth.decorators';

import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { QuoteDeliveryDto } from './dto/quote-delivery.dto';

@Controller('batches')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Post(':batchId/deliveries/quote')
  @Roles(UserRole.ADMIN)
  quote(@Param('batchId') batchId: string, @Body() dto: QuoteDeliveryDto) {
    return this.deliveriesService.quote(batchId, dto);
  }

  @Post(':batchId/deliveries')
  @Roles(UserRole.ADMIN)
  create(@Param('batchId') batchId: string, @Body() dto: CreateDeliveryDto) {
    return this.deliveriesService.create(batchId, dto);
  }

  @Delete(':batchId/deliveries')
  @Roles(UserRole.ADMIN)
  cancel(@Param('batchId') batchId: string) {
    return this.deliveriesService.cancel(batchId);
  }
}
