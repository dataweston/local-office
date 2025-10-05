import type { Job } from 'bullmq';
import type { PrismaClient, WebhookEvent } from '@local-office/db';

import { getLogger } from '../utils/logging';

const logger = getLogger();

export interface WebhookJobData {
  eventId?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  limit?: number;
}

export interface WebhookDependencies {
  deliver?: (input: { endpoint: string; event: WebhookEvent; headers?: Record<string, string> }) => Promise<void>;
  now?: () => Date;
}

async function defaultDeliver({ endpoint, event, headers }: { endpoint: string; event: WebhookEvent; headers?: Record<string, string> }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-local-office-event': event.type,
      ...headers
    },
    body: JSON.stringify(event.payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed with status ${response.status}`);
  }
}

function resolveBackoff(job: Job): number {
  const { backoff } = job.opts ?? {};
  if (!backoff) {
    return 0;
  }

  if (typeof backoff === 'number') {
    return backoff;
  }

  if (typeof backoff === 'object') {
    const baseDelay = typeof backoff.delay === 'number' ? backoff.delay : 0;
    if (backoff.type === 'exponential') {
      return baseDelay * Math.max(1, 2 ** job.attemptsMade);
    }
    return baseDelay;
  }

  return 0;
}

function resolveEndpoint(input: string | undefined, event: WebhookEvent) {
  if (input) {
    return input;
  }
  const payload = event.payload as Record<string, unknown> | null;
  const endpoint = payload && typeof payload.endpoint === 'string' ? (payload.endpoint as string) : undefined;
  if (!endpoint) {
    throw new Error('Webhook endpoint is not defined for event');
  }
  return endpoint;
}

export function createWebhookJob(prisma: PrismaClient, deps: WebhookDependencies = {}) {
  const deliver = deps.deliver ?? defaultDeliver;
  const now = deps.now ?? (() => new Date());

  async function processEvent(
    event: WebhookEvent,
    job: Job<WebhookJobData>,
    endpointOverride?: string,
    headers?: Record<string, string>
  ) {
    if (event.status === 'delivered') {
      return { eventId: event.id, status: event.status };
    }

    const endpoint = resolveEndpoint(endpointOverride, event);
    const attemptNumber = event.attempts + 1;

    try {
      await deliver({ endpoint, event, headers });

      const timestamp = now();
      const updated = await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'delivered',
          deliveredAt: timestamp,
          attempts: attemptNumber,
          nextAttempt: null
        }
      });

      logger.info({ eventId: event.id, attempts: attemptNumber }, 'webhook delivered');
      return { eventId: event.id, status: updated.status };
    } catch (error) {
      const delay = resolveBackoff(job);
      const nextAttempt = delay ? new Date(now().getTime() + delay) : null;

      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          attempts: attemptNumber,
          nextAttempt,
          status: 'pending'
        }
      });

      logger.warn({ eventId: event.id, attempts: attemptNumber, delay }, 'webhook delivery failed');
      throw error;
    }
  }

  return async function handleWebhook(job: Job<WebhookJobData>) {
    const { eventId, endpoint, headers, limit = 25 } = job.data ?? {};

    const events = eventId
      ? [await prisma.webhookEvent.findUnique({ where: { id: eventId } })].filter((event): event is WebhookEvent => Boolean(event))
      : await prisma.webhookEvent.findMany({
          where: { status: 'pending' },
          orderBy: { createdAt: 'asc' },
          take: limit
        });

    const results: Array<{ eventId: string; status: string }> = [];
    for (const event of events) {
      try {
        results.push(await processEvent(event, job, endpoint, headers));
      } catch (error) {
        logger.warn({ eventId: event.id, error }, 'webhook processing error');
        throw error;
      }
    }

    return results;
  };
}
