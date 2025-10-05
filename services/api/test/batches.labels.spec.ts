import { NotFoundException } from '@nestjs/common';
import { beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

import { BatchesService } from '../src/modules/batches/batches.service';
import { createLabelsProcessor } from '../../worker/src/processors/labels';
import { createObjectStorage } from '../../worker/src/storage';

describe('Batch labels integration', () => {
  const batchId = 'batch-123';
  const dataset = createDataset(batchId);
  let prisma: FakePrismaService;
  let queue: FakeQueue;
  let tempDir: string;

  beforeEach(async () => {
    prisma = new FakePrismaService(dataset);
    queue = new FakeQueue();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'labels-test-'));
    process.env.OBJECT_STORAGE_DIR = tempDir;
    process.env.OBJECT_STORAGE_PUBLIC_URL = 'http://storage.local/';
  });

  afterEach(async () => {
    delete process.env.OBJECT_STORAGE_DIR;
    delete process.env.OBJECT_STORAGE_PUBLIC_URL;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('queues a job and surfaces URLs after processing', async () => {
    const service = new BatchesService(prisma as any, queue as any);

    const initial = await service.getLabels(batchId);
    assert.equal(initial.status, 'pending');
    assert.equal(initial.pdfUrl, null);
    assert.equal(initial.labels.length, 0);

    const accepted = await service.requestLabels(batchId);
    assert.deepEqual(accepted, { batchId, status: 'queued' });
    assert.equal(queue.jobs.length, 1);
    assert.equal(queue.jobs[0].opts?.jobId, `batch-labels:${batchId}`);

    const storage = createObjectStorage();
    const handler = createLabelsProcessor({ prisma: prisma as any, storage, now: () => new Date('2024-01-01T00:00:00Z') });
    await handler({ id: 'job-1', data: { batchId } } as any);

    const response = await service.getLabels(batchId);
    assert.equal(response.status, 'ready');
    assert.match(response.pdfUrl ?? '', /^http:\/\/storage\.local\/labels\//);
    assert.match(response.zplUrl ?? '', /\.zpl$/);
    assert.equal(response.labels.length, 2);
    assert.ok(response.labels.every((label) => label.pdfUrl === response.pdfUrl));
    assert.deepEqual(response.labels[0].allergens, ['Dairy']);

    const pdfPath = path.join(tempDir, (response.pdfUrl ?? '').replace('http://storage.local/', ''));
    const zplPath = path.join(tempDir, (response.zplUrl ?? '').replace('http://storage.local/', ''));
    await assert.doesNotReject(() => fs.access(pdfPath));
    await assert.doesNotReject(() => fs.access(zplPath));
  });

  it('throws when batch does not exist', async () => {
    const service = new BatchesService(prisma as any, queue as any);

    await assert.rejects(() => service.requestLabels('missing'), NotFoundException);
    await assert.rejects(() => service.getLabels('missing'), NotFoundException);
  });
});

interface Dataset {
  batch: { id: string };
  users: Array<{ id: string; firstName: string; lastName: string }>;
  skus: Array<{ id: string; name: string }>;
  allergens: Array<{ id: string; name: string }>;
  skuAllergens: Record<string, string[]>;
  orders: Array<{
    id: string;
    userId: string;
    items: Array<{ id: string; skuId: string; quantity: number }>;
  }>;
}

function createDataset(id: string): Dataset {
  return {
    batch: { id },
    users: [{ id: 'user-1', firstName: 'Avery', lastName: 'Admin' }],
    skus: [{ id: 'sku-1', name: 'Margherita Pizza' }],
    allergens: [{ id: 'allergen-1', name: 'Dairy' }],
    skuAllergens: { 'sku-1': ['allergen-1'] },
    orders: [
      {
        id: 'order-1',
        userId: 'user-1',
        items: [
          { id: 'item-1', skuId: 'sku-1', quantity: 2 }
        ]
      }
    ]
  };
}

class FakePrismaService {
  private labelsStore: Array<LabelRecord> = [];
  private labelSequence = 1;

  constructor(private readonly data: Dataset) {}

  batch = {
    findUnique: async ({ where, include, select }: any) => {
      if (where.id !== this.data.batch.id) {
        return null;
      }

      if (select) {
        const result: Record<string, unknown> = {};
        Object.keys(select).forEach((key) => {
          if (select[key]) {
            result[key] = (this.data.batch as any)[key];
          }
        });
        return result;
      }

      if (include?.orders) {
        return {
          ...this.data.batch,
          orders: this.data.orders.map((order) => ({
            ...order,
            user: this.data.users.find((user) => user.id === order.userId)!,
            items: order.items.map((item) => ({
              ...item,
              sku: {
                ...this.data.skus.find((sku) => sku.id === item.skuId)!,
                allergens: (this.data.skuAllergens[item.skuId] ?? []).map((allergenId) => ({
                  allergen: this.data.allergens.find((allergen) => allergen.id === allergenId)!
                }))
              }
            }))
          }))
        };
      }

      return { ...this.data.batch };
    }
  };

  label = {
    findMany: async ({ where }: any) =>
      this.labelsStore
        .filter((label) => !where?.batchId || label.batchId === where.batchId)
        .map((label) => ({ ...label })),
    deleteMany: async ({ where }: any) => {
      const before = this.labelsStore.length;
      this.labelsStore = this.labelsStore.filter((label) => label.batchId !== where.batchId);
      return { count: before - this.labelsStore.length };
    },
    createMany: async ({ data }: any) => {
      const createdAt = new Date();
      for (const entry of data) {
        this.labelsStore.push({
          id: `label-${this.labelSequence++}`,
          createdAt,
          updatedAt: createdAt,
          ...entry
        });
      }
      return { count: data.length };
    }
  };
}

interface LabelRecord {
  id: string;
  batchId: string;
  orderId: string;
  name: string;
  item: string;
  allergens: string[];
  pdfUrl: string | null;
  zplUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

class FakeQueue {
  public jobs: Array<{ name: string; data: any; opts?: any }> = [];

  async add(name: string, data: any, opts?: any) {
    this.jobs.push({ name, data, opts });
    return { id: opts?.jobId ?? name, name, data };
  }

  async close() {}
}
