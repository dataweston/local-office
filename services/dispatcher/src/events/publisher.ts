import { Queue } from 'bullmq';
import pino from 'pino';

import type { DeliveryUpdate } from '..';

const logger = pino({ name: 'delivery-update-publisher' });

export interface DeliveryUpdateEvent extends DeliveryUpdate {
  receivedAt: string;
}

export interface DeliveryUpdateTransport {
  send(event: DeliveryUpdateEvent): Promise<void>;
}

export type DeliveryUpdatePublisher = (update: DeliveryUpdate) => Promise<void>;

class BullMqTransport implements DeliveryUpdateTransport {
  private readonly queue: Queue<DeliveryUpdateEvent>;

  constructor() {
    const url = process.env.DISPATCHER_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.queue = new Queue<DeliveryUpdateEvent>('delivery-updates', {
      connection: {
        url,
        lazyConnect: true
      }
    });
  }

  async send(event: DeliveryUpdateEvent): Promise<void> {
    await this.queue.add('delivery-update', event, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 100
    });
  }
}

let transport: DeliveryUpdateTransport | null = null;

function resolveTransport(): DeliveryUpdateTransport {
  if (!transport) {
    transport = new BullMqTransport();
  }

  return transport;
}

export function setDeliveryUpdateTransport(custom: DeliveryUpdateTransport | null): void {
  transport = custom;
}

export const publishDeliveryUpdate: DeliveryUpdatePublisher = async (update) => {
  const event: DeliveryUpdateEvent = {
    ...update,
    receivedAt: new Date().toISOString()
  };

  try {
    await resolveTransport().send(event);
  } catch (error) {
    logger.error({ error, event }, 'failed to publish delivery update');
    throw error;
  }
};
