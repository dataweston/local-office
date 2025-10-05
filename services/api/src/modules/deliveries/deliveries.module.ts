import { Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { AdapterRegistry } from '@local-office/dispatcher';
import { DispatchAdapter, OloAdapter, UberDirectAdapter } from '@local-office/dispatcher/adapters';

import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import {
  DELIVERY_ADAPTERS,
  DELIVERY_UPDATES_QUEUE,
  DELIVERY_UPDATES_QUEUE_NAME,
  queueConnection
} from './deliveries.constants';

function buildAdapterRegistry(): AdapterRegistry {
  const registry: AdapterRegistry = {};

  if (process.env.DISPATCH_API_KEY && process.env.DISPATCH_BASE_URL && process.env.DISPATCH_WEBHOOK_SECRET) {
    registry['dispatch'] = new DispatchAdapter({
      apiKey: process.env.DISPATCH_API_KEY,
      baseUrl: process.env.DISPATCH_BASE_URL,
      webhookSecret: process.env.DISPATCH_WEBHOOK_SECRET
    });
  }

  if (
    process.env.UBER_DIRECT_CLIENT_ID &&
    process.env.UBER_DIRECT_CLIENT_SECRET &&
    process.env.UBER_DIRECT_WEBHOOK_SECRET
  ) {
    const baseUrl = process.env.UBER_DIRECT_BASE_URL;
    const authUrl = process.env.UBER_DIRECT_AUTH_URL;
    const scope = process.env.UBER_DIRECT_SCOPE;

    registry['uber-direct'] = new UberDirectAdapter({
      clientId: process.env.UBER_DIRECT_CLIENT_ID,
      clientSecret: process.env.UBER_DIRECT_CLIENT_SECRET,
      webhookSecret: process.env.UBER_DIRECT_WEBHOOK_SECRET,
      ...(baseUrl ? { baseUrl } : {}),
      ...(authUrl ? { authUrl } : {}),
      ...(scope ? { scope } : {})
    });
  }

  if (process.env.OLO_API_KEY && process.env.OLO_BASE_URL && process.env.OLO_WEBHOOK_SECRET) {
    registry['olo'] = new OloAdapter({
      apiKey: process.env.OLO_API_KEY,
      baseUrl: process.env.OLO_BASE_URL,
      webhookSecret: process.env.OLO_WEBHOOK_SECRET
    });
  }

  return registry;
}

@Injectable()
class DeliveryUpdatesQueueProvider implements OnModuleDestroy {
  readonly queue = new Queue(DELIVERY_UPDATES_QUEUE_NAME, queueConnection);

  async onModuleDestroy() {
    await this.queue.close();
  }
}

@Module({
  controllers: [DeliveriesController],
  providers: [
    DeliveriesService,
    DeliveryUpdatesQueueProvider,
    {
      provide: DELIVERY_UPDATES_QUEUE,
      useFactory: (provider: DeliveryUpdatesQueueProvider) => provider.queue,
      inject: [DeliveryUpdatesQueueProvider]
    },
    {
      provide: DELIVERY_ADAPTERS,
      useFactory: () => buildAdapterRegistry()
    }
  ]
})
export class DeliveriesModule {}
