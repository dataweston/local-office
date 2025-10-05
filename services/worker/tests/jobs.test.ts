import { describe, expect, it, vi } from 'vitest';
import { Queue, Worker, JobScheduler } from 'bullmq';
import { createBatcherJob } from '../src/jobs/batcher';
import { createWebhookJob } from '../src/jobs/webhook-out';

const OrderStatus = {
  PENDING: 'PENDING',
  LOCKED: 'LOCKED',
  BATCHED: 'BATCHED'
} as const;

const BatchStatus = {
  LOCKED: 'LOCKED'
} as const;

async function createRedis(queueName: string) {
  const connection = { connection: { host: '127.0.0.1', port: 6379 } } as const;
  const queue = new Queue(queueName, connection);
  const scheduler = new JobScheduler(queueName, connection);
  await scheduler.waitUntilReady();
  return { connection, queue, scheduler };
}

async function shutdownRedis(queue: Queue, scheduler: JobScheduler) {
  await queue.drain(true);
  await queue.close();
  await scheduler.close();
}

describe('batcher job', () => {
  it('locks pending orders and creates batches', async () => {
    const state = {
      programSlots: new Map([
        [
          'slot-1',
          {
            id: 'slot-1',
            providerId: 'provider-1',
            cutoffAt: new Date(Date.now() - 60_000),
            program: { siteId: 'site-1', orgId: 'org-1' }
          }
        ]
      ]),
      orders: [
        { id: 'order-1', programSlotId: 'slot-1', status: OrderStatus.PENDING, batchId: null as string | null },
        { id: 'order-2', programSlotId: 'slot-1', status: OrderStatus.LOCKED, batchId: null as string | null }
      ],
      batches: new Map<string, { id: string; status: BatchStatus; siteId: string; providerId: string; orgId: string; programSlotId: string }>()
    };

    const prisma = {
      programSlot: {
        findMany: vi.fn(async () => Array.from(state.programSlots.values())),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          const slot = state.programSlots.get(where.id);
          return slot ? { ...slot } : null;
        })
      },
      order: {
        updateMany: vi.fn(async ({ where, data }: any) => {
          let count = 0;
          for (const order of state.orders) {
            const slotMatches = !where.programSlotId || order.programSlotId === where.programSlotId;
            const statusMatches = !where.status
              ? true
              : typeof where.status === 'string'
                ? order.status === where.status
                : Array.isArray(where.status.in)
                  ? where.status.in.includes(order.status)
                  : false;
            const batchMatches =
              where.batchId === null ? order.batchId === null : where.batchId === undefined ? true : order.batchId === where.batchId;
            if (slotMatches && statusMatches && batchMatches) {
              if (data.status) {
                order.status = data.status;
              }
              if (data.batchId !== undefined) {
                order.batchId = data.batchId;
              }
              count += 1;
            }
          }
          return { count };
        })
      },
      batch: {
        upsert: vi.fn(async ({ where, create }: any) => {
          const key = `${where.siteId_providerId_programSlotId.siteId}:${where.siteId_providerId_programSlotId.providerId}:${where.siteId_providerId_programSlotId.programSlotId}`;
          const existing = state.batches.get(key);
          if (existing) {
            existing.status = create.status ?? existing.status;
            return { ...existing };
          }
          const batch = {
            id: `batch-${state.batches.size + 1}`,
            status: create.status ?? BatchStatus.LOCKED,
            siteId: create.siteId,
            providerId: create.providerId,
            orgId: create.orgId,
            programSlotId: create.programSlotId
          };
          state.batches.set(key, batch);
          return { ...batch };
        })
      },
      $transaction: (fn: any) => fn(prisma)
    } as any;

    const { connection, queue, scheduler } = await createRedis('batcher-test');
    const worker = new Worker(queue.name, createBatcherJob(prisma), { ...connection });

    const resultPromise = new Promise<any>((resolve, reject) => {
      worker.once('completed', (_job, result) => resolve(result));
      worker.once('failed', reject);
    });

    await queue.add('lock-orders', { programSlotId: 'slot-1' });
    const result = await resultPromise;

    expect(result).toEqual([
      {
        programSlotId: 'slot-1',
        batchId: expect.any(String),
        lockedCount: 1,
        batchedCount: 2
      }
    ]);
    expect(state.orders.every((order) => order.status === OrderStatus.BATCHED && order.batchId === result[0].batchId)).toBe(true);
    expect(state.batches.size).toBe(1);

    await worker.close();
    await shutdownRedis(queue, scheduler);
  });
});

describe('webhook job', () => {
  it('retries delivery and updates attempt metadata', async () => {
    const eventState = {
      event: {
        id: 'evt-1',
        type: 'demo.event',
        payload: { endpoint: 'https://example.com/webhook' },
        attempts: 0,
        deliveredAt: null as Date | null,
        nextAttempt: null as Date | null,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    const deliverMock = vi.fn(async () => undefined);
    deliverMock.mockRejectedValueOnce(new Error('network error')).mockResolvedValueOnce(undefined);

    const prisma = {
      webhookEvent: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return where.id === eventState.event.id ? { ...eventState.event } : null;
        }),
        findMany: vi.fn(async () => [{ ...eventState.event }]),
        update: vi.fn(async ({ where, data }: any) => {
          if (where.id !== eventState.event.id) {
            throw new Error('Event not found');
          }
          Object.assign(eventState.event, data, { updatedAt: new Date() });
          return { ...eventState.event };
        })
      }
    } as any;

    const { connection, queue, scheduler } = await createRedis('webhook-test');
    const worker = new Worker(
      queue.name,
      createWebhookJob(prisma, {
        deliver: async (input) => deliverMock(input),
        now: () => new Date()
      }),
      { ...connection }
    );

    const completion = new Promise<any>((resolve, reject) => {
      worker.once('completed', (_job, result) => resolve(result));
      worker.on('failed', (job, error) => {
        const maxAttempts = job.opts.attempts ?? 1;
        if (job.attemptsMade >= maxAttempts) {
          reject(error);
        }
      });
    });

    await queue.add(
      'deliver-pending-webhooks',
      { eventId: eventState.event.id },
      { attempts: 2, backoff: { type: 'fixed', delay: 10 } }
    );

    const result = await completion;

    expect(deliverMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      {
        eventId: eventState.event.id,
        status: 'delivered'
      }
    ]);
    expect(eventState.event.status).toBe('delivered');
    expect(eventState.event.attempts).toBe(2);
    expect(eventState.event.nextAttempt).toBeNull();
    expect(eventState.event.deliveredAt).toBeInstanceOf(Date);

    await worker.close();
    await shutdownRedis(queue, scheduler);
  });
});
