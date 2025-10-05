import { Module } from '@nestjs/common';

import { billingProvider } from '../billing.provider';
import { BatchLockProducer } from '../batch-lock.producer';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, billingProvider, BatchLockProducer]
})
export class OrdersModule {}
