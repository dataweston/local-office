import { Queue, Worker, QueueScheduler, type JobsOptions, type QueueOptions } from 'bullmq';
import { prisma } from '@local-office/db';
import { createIdempotencyKey } from '@local-office/lib';

import { BillingService } from '@local-office/billing';
import { createBatcherJob } from './jobs/batcher';
import { createInvoiceJob } from './jobs/invoice';
import { createLabelJob } from './jobs/labels';
import { createDeliveryUpdateJob } from './jobs/delivery-update';
import { createDefaultNotificationClient, createNotifyJob } from './jobs/notify';
import { createWebhookJob } from './jobs/webhook-out';
import { createObjectStorage } from './storage';
import { getLogger, withJobLogging } from './utils/logging';

const logger = getLogger();

function parseIntEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const baseConnection = {
  connection: {
    url: redisUrl
  }
} satisfies QueueOptions;

type QueueName = 'batcher' | 'labels' | 'notify' | 'invoice' | 'webhook-out' | 'delivery-updates';

interface QueueConfiguration {
  concurrency: number;
  defaultJobOptions: JobsOptions;
}

const queueConfigurations: Record<QueueName, QueueConfiguration> = {
  batcher: {
    concurrency: parseIntEnv('WORKER_BATCHER_CONCURRENCY', 4),
    defaultJobOptions: {
      attempts: parseIntEnv('WORKER_BATCHER_ATTEMPTS', 3),
      backoff: {
        type: 'fixed',
        delay: parseIntEnv('WORKER_BATCHER_RETRY_DELAY_MS', 60_000)
      },
      removeOnComplete: 500,
      removeOnFail: 1_000
    }
  },
  labels: {
    concurrency: parseIntEnv('WORKER_LABELS_CONCURRENCY', 2),
    defaultJobOptions: {
      attempts: parseIntEnv('WORKER_LABELS_ATTEMPTS', 3),
      backoff: {
        type: 'exponential',
        delay: parseIntEnv('WORKER_LABELS_RETRY_DELAY_MS', 30_000)
      },
      removeOnComplete: 200,
      removeOnFail: 1_000
    }
  },
  notify: {
    concurrency: parseIntEnv('WORKER_NOTIFY_CONCURRENCY', 5),
    defaultJobOptions: {
      attempts: parseIntEnv('WORKER_NOTIFY_ATTEMPTS', 2),
      backoff: {
        type: 'fixed',
        delay: parseIntEnv('WORKER_NOTIFY_RETRY_DELAY_MS', 15_000)
      },
      removeOnComplete: 500,
      removeOnFail: 1_000
    }
  },
  invoice: {
    concurrency: parseIntEnv('WORKER_INVOICE_CONCURRENCY', 1),
    defaultJobOptions: {
      attempts: parseIntEnv('WORKER_INVOICE_ATTEMPTS', 1),
      removeOnComplete: 20,
      removeOnFail: 200
    }
  },
  'webhook-out': {
    concurrency: parseIntEnv('WORKER_WEBHOOK_CONCURRENCY', 3),
    defaultJobOptions: {
      attempts: parseIntEnv('WORKER_WEBHOOK_ATTEMPTS', 5),
      backoff: {
        type: 'exponential',
        delay: parseIntEnv('WORKER_WEBHOOK_RETRY_DELAY_MS', 10_000)
      },
      removeOnComplete: 500,
      removeOnFail: false
    }
  },
  'delivery-updates': {
    concurrency: parseIntEnv('WORKER_DELIVERY_UPDATES_CONCURRENCY', 5),
    defaultJobOptions: {
      attempts: parseIntEnv('WORKER_DELIVERY_UPDATES_ATTEMPTS', 5),
      backoff: {
        type: 'exponential',
        delay: parseIntEnv('WORKER_DELIVERY_UPDATES_RETRY_DELAY_MS', 15_000)
      },
      removeOnComplete: 500,
      removeOnFail: 1_000
    }
  }
};

function queueOptions(name: QueueName): QueueOptions {
  return {
    ...baseConnection,
    defaultJobOptions: queueConfigurations[name].defaultJobOptions
  } satisfies QueueOptions;
}

export const queues = {
  batcher: new Queue('batcher', queueOptions('batcher')),
  labels: new Queue('labels', queueOptions('labels')),
  notify: new Queue('notify', queueOptions('notify')),
  invoice: new Queue('invoice', queueOptions('invoice')),
  webhookOut: new Queue('webhook-out', queueOptions('webhook-out')),
  deliveryUpdates: new Queue('delivery-updates', queueOptions('delivery-updates'))
};

const schedulers = Object.values(queues).map((queue) => new QueueScheduler(queue.name, baseConnection));
void schedulers;

const storage = createObjectStorage();
const notifier = createDefaultNotificationClient();
const billing = new BillingService();

const workers = [
  new Worker(
    queues.batcher.name,
    withJobLogging('batcher', createBatcherJob(prisma)),
    { ...baseConnection, concurrency: queueConfigurations.batcher.concurrency }
  ),
  new Worker(
    queues.labels.name,
    withJobLogging('labels', createLabelJob(prisma, { storage })),
    { ...baseConnection, concurrency: queueConfigurations.labels.concurrency }
  ),
  new Worker(
    queues.notify.name,
    withJobLogging('notify', createNotifyJob(prisma, notifier)),
    { ...baseConnection, concurrency: queueConfigurations.notify.concurrency }
  ),
  new Worker(
    queues.invoice.name,
    withJobLogging('invoice', createInvoiceJob(prisma, billing)),
    { ...baseConnection, concurrency: queueConfigurations.invoice.concurrency }
  ),
  new Worker(
    queues.webhookOut.name,
    withJobLogging('webhook-out', createWebhookJob(prisma)),
    { ...baseConnection, concurrency: queueConfigurations['webhook-out'].concurrency }
  ),
  new Worker(
    queues.deliveryUpdates.name,
    withJobLogging('delivery-updates', createDeliveryUpdateJob(prisma)),
    { ...baseConnection, concurrency: queueConfigurations['delivery-updates'].concurrency }
  )
];
void workers;

async function registerRepeatableJobs() {
  const batcherCron = process.env.BATCHER_LOCK_CRON;
  if (batcherCron) {
    await queues.batcher.add(
      'lock-expiring-orders',
      {},
      {
        repeat: { pattern: batcherCron },
        jobId: 'batcher:lock-expiring-orders'
      }
    );
  }

  const labelsCron = process.env.LABEL_REFRESH_CRON;
  if (labelsCron) {
    await queues.labels.add(
      'refresh-labels',
      {},
      {
        repeat: { pattern: labelsCron },
        jobId: 'labels:refresh'
      }
    );
  }

  const notifyCron = process.env.NOTIFY_DISPATCH_CRON;
  if (notifyCron) {
    await queues.notify.add(
      'dispatch-notifications',
      {},
      {
        repeat: { pattern: notifyCron },
        jobId: 'notify:dispatch'
      }
    );
  }

  const invoiceCron = process.env.INVOICE_GENERATION_CRON;
  if (invoiceCron) {
    await queues.invoice.add(
      'generate-periodic-invoices',
      {},
      {
        repeat: { pattern: invoiceCron },
        jobId: 'invoice:generate'
      }
    );
  }

  const webhookCron = process.env.WEBHOOK_OUTBOX_CRON;
  if (webhookCron) {
    await queues.webhookOut.add(
      'deliver-pending-webhooks',
      {},
      {
        repeat: { pattern: webhookCron },
        jobId: 'webhook:deliver-pending'
      }
    );
  }
}

registerRepeatableJobs().catch((error) => {
  logger.error({ error }, 'failed to register repeatable jobs');
});

export async function enqueueBatchLock(data: Record<string, unknown>, opts?: JobsOptions) {
  return queues.batcher.add('lock-orders', data, {
    jobId: (data['idempotencyKey'] as string | undefined) ?? createIdempotencyKey('batch-lock'),
    ...opts
  });
}

export async function enqueueBatchLabels(batchId: string, opts?: JobsOptions) {
  return queues.labels.add(
    'generate-batch-labels',
    { batchId },
    {
      jobId: `batch-labels:${batchId}`,
      removeOnComplete: true,
      removeOnFail: true,
      ...opts
    }
  );
}

logger.info('Worker bootstrapped');
