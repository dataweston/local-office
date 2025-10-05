import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeliveryStatus } from '@local-office/db';

import { DeliveriesService } from './deliveries.service';
import type { CreateDeliveryDto } from './dto/create-delivery.dto';
import type { QuoteDeliveryDto } from './dto/quote-delivery.dto';

describe('DeliveriesService', () => {
  const batchId = 'batch-123';
  let prisma: any;
  let queue: any;
  let adapters: any;
  let service: DeliveriesService;

  beforeEach(() => {
    prisma = {
      batch: {
        findUnique: mock.fn()
      },
      deliveryJob: {
        upsert: mock.fn(),
        findUnique: mock.fn(),
        update: mock.fn()
      }
    };

    queue = {
      add: mock.fn()
    };

    adapters = {
      dispatch: {
        quote: mock.fn(),
        create: mock.fn(),
        cancel: mock.fn()
      }
    };

    service = new DeliveriesService(prisma as any, adapters as any, queue as any);
  });

  describe('quote', () => {
    const dto: QuoteDeliveryDto = {
      adapter: 'dispatch',
      pickupAddress: '123 Warehouse Ave',
      dropoffAddress: '500 Office Blvd',
      readyAt: '2024-01-01T12:00:00Z',
      reference: 'batch-123'
    };

    it('delegates to the adapter after ensuring the batch exists', async () => {
      prisma.batch.findUnique.mock.mockResolvedValue({ id: batchId });
      adapters.dispatch.quote.mock.mockResolvedValue({ fee: 12.5, currency: 'USD', etaMinutes: 45 });

      const result = await service.quote(batchId, dto);

      assert.equal(prisma.batch.findUnique.mock.callCount(), 1);
      assert.equal(adapters.dispatch.quote.mock.callCount(), 1);
      assert.deepEqual(adapters.dispatch.quote.mock.calls[0].arguments[0], {
        pickupAddress: dto.pickupAddress,
        dropoffAddress: dto.dropoffAddress,
        readyAt: dto.readyAt,
        reference: dto.reference
      });
      assert.deepEqual(result, { fee: 12.5, currency: 'USD', etaMinutes: 45 });
    });

    it('throws when the batch is missing', async () => {
      prisma.batch.findUnique.mock.mockResolvedValue(null);

      await assert.rejects(() => service.quote(batchId, dto), NotFoundException);
      assert.equal(adapters.dispatch.quote.mock.callCount(), 0);
    });
  });

  describe('create', () => {
    const dto: CreateDeliveryDto = {
      adapter: 'dispatch',
      pickupAddress: '123 Warehouse Ave',
      dropoffAddress: '500 Office Blvd',
      readyAt: '2024-01-01T12:00:00Z',
      reference: 'batch-123',
      contactEmail: 'ops@example.com',
      contactPhone: '555-1234'
    };

    it('creates the delivery job record and enqueues an update job', async () => {
      prisma.batch.findUnique.mock.mockResolvedValue({ id: batchId });
      adapters.dispatch.create.mock.mockResolvedValue({ externalJobId: 'ext-1', trackingUrl: 'https://track/1' });
      const record = {
        id: 'delivery-1',
        batchId,
        adapter: 'dispatch',
        externalJobId: 'ext-1',
        trackingUrl: 'https://track/1',
        status: DeliveryStatus.REQUESTED
      };
      prisma.deliveryJob.upsert.mock.mockResolvedValue(record);
      queue.add.mock.mockResolvedValue({ id: 'queue-1' });

      const result = await service.create(batchId, dto);

      assert.equal(adapters.dispatch.create.mock.callCount(), 1);
      assert.deepEqual(adapters.dispatch.create.mock.calls[0].arguments[0], {
        pickupAddress: dto.pickupAddress,
        dropoffAddress: dto.dropoffAddress,
        readyAt: dto.readyAt,
        reference: dto.reference,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone
      });

      assert.equal(prisma.deliveryJob.upsert.mock.callCount(), 1);
      const upsertArgs = prisma.deliveryJob.upsert.mock.calls[0].arguments[0];
      assert.equal(upsertArgs.where.batchId, batchId);
      assert.equal(upsertArgs.create.adapter, dto.adapter);
      assert.equal(upsertArgs.create.externalJobId, 'ext-1');
      assert.equal(upsertArgs.create.trackingUrl, 'https://track/1');
      assert.equal(upsertArgs.create.status, DeliveryStatus.REQUESTED);
      assert.equal(upsertArgs.update.status, DeliveryStatus.REQUESTED);

      assert.equal(queue.add.mock.callCount(), 1);
      const queueArgs = queue.add.mock.calls[0].arguments;
      assert.equal(queueArgs[0], 'delivery-update');
      assert.deepEqual(queueArgs[1], {
        provider: dto.adapter,
        externalJobId: 'ext-1',
        status: 'requested',
        trackingUrl: 'https://track/1',
        rawPayload: { source: 'api.deliveries.create', batchId }
      });
      assert.equal(queueArgs[2]?.jobId, 'delivery:ext-1');

      assert.deepEqual(result, record);
    });

    it('throws when the adapter result is missing the external job id', async () => {
      prisma.batch.findUnique.mock.mockResolvedValue({ id: batchId });
      adapters.dispatch.create.mock.mockResolvedValue({ externalJobId: '', trackingUrl: undefined });

      await assert.rejects(() => service.create(batchId, dto), BadRequestException);
      assert.equal(prisma.deliveryJob.upsert.mock.callCount(), 0);
    });

    it('throws when the adapter is not registered', async () => {
      prisma.batch.findUnique.mock.mockResolvedValue({ id: batchId });

      await assert.rejects(
        () => service.create(batchId, { ...dto, adapter: 'unknown' }),
        BadRequestException
      );
    });
  });

  describe('cancel', () => {
    it('cancels the delivery job, updates status, and enqueues a follow-up', async () => {
      const deliveryJob = {
        id: 'delivery-1',
        batchId,
        adapter: 'dispatch',
        externalJobId: 'ext-1',
        status: DeliveryStatus.REQUESTED
      };
      prisma.deliveryJob.findUnique.mock.mockResolvedValue(deliveryJob);
      prisma.deliveryJob.update.mock.mockImplementation(async ({ data }: any) => ({ ...deliveryJob, ...data }));
      queue.add.mock.mockResolvedValue({ id: 'queue-2' });

      const result = await service.cancel(batchId);

      assert.equal(adapters.dispatch.cancel.mock.callCount(), 1);
      assert.equal(adapters.dispatch.cancel.mock.calls[0].arguments[0], 'ext-1');

      assert.equal(prisma.deliveryJob.update.mock.callCount(), 1);
      const updateArgs = prisma.deliveryJob.update.mock.calls[0].arguments[0];
      assert.equal(updateArgs.where.id, deliveryJob.id);
      assert.equal(updateArgs.data.status, DeliveryStatus.CANCELED);
      assert.ok(updateArgs.data.canceledAt instanceof Date);

      assert.equal(queue.add.mock.callCount(), 1);
      const queueArgs = queue.add.mock.calls[0].arguments;
      assert.equal(queueArgs[0], 'delivery-update');
      assert.equal(queueArgs[1].provider, 'dispatch');
      assert.equal(queueArgs[1].externalJobId, 'ext-1');
      assert.equal(queueArgs[1].status, 'canceled');
      assert.equal(queueArgs[2]?.jobId, 'delivery:ext-1:cancel');

      assert.equal(result.status, DeliveryStatus.CANCELED);
    });

    it('throws when the delivery job is missing', async () => {
      prisma.deliveryJob.findUnique.mock.mockResolvedValue(null);

      await assert.rejects(() => service.cancel(batchId), NotFoundException);
    });

    it('throws when the delivery job lacks an external identifier', async () => {
      prisma.deliveryJob.findUnique.mock.mockResolvedValue({
        id: 'delivery-1',
        batchId,
        adapter: 'dispatch',
        externalJobId: null
      });

      await assert.rejects(() => service.cancel(batchId), BadRequestException);
      assert.equal(adapters.dispatch.cancel.mock.callCount(), 0);
    });
  });
});
