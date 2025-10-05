import type { Job } from 'bullmq';
import type { Prisma, PrismaClient } from '@local-office/db';
import { DeliveryStatus } from '@local-office/db';

export interface DeliveryUpdateJobData {
  provider: string;
  externalJobId: string;
  status?: string;
  timestamps?: Record<string, string | undefined>;
  proof?: {
    url: string;
    type?: string;
  };
  trackingUrl?: string;
  rawPayload: unknown;
}

type TimestampField = 'acceptedAt' | 'pickedUpAt' | 'deliveredAt' | 'canceledAt' | 'failedAt';

type TimestampUpdates = Partial<Record<TimestampField, Date>>;

const STATUS_RULES: Array<{ pattern: RegExp; status: DeliveryStatus }> = [
  { pattern: /(deliver|complete|finish)/i, status: DeliveryStatus.DELIVERED },
  { pattern: /(pick|route|out_for_delivery|depart|en_route)/i, status: DeliveryStatus.PICKED_UP },
  { pattern: /(accept|assign|dispatch|acknow)/i, status: DeliveryStatus.ACCEPTED },
  { pattern: /(cancel|void)/i, status: DeliveryStatus.CANCELED },
  { pattern: /(fail|error|return)/i, status: DeliveryStatus.FAILED },
  { pattern: /(request|create|pending|open)/i, status: DeliveryStatus.REQUESTED }
];

const TIMESTAMP_RULES: Array<{ pattern: RegExp; field: TimestampField }> = [
  { pattern: /(accept|assign|dispatch|acknow)/i, field: 'acceptedAt' },
  { pattern: /(pick|route|depart|out_for_delivery|en_route)/i, field: 'pickedUpAt' },
  { pattern: /(deliver|complete|finish|dropoff)/i, field: 'deliveredAt' },
  { pattern: /(cancel|void)/i, field: 'canceledAt' },
  { pattern: /(fail|error|return)/i, field: 'failedAt' }
];

const STATUS_PRIORITY: Record<DeliveryStatus, number> = {
  [DeliveryStatus.REQUESTED]: 0,
  [DeliveryStatus.ACCEPTED]: 1,
  [DeliveryStatus.PICKED_UP]: 2,
  [DeliveryStatus.DELIVERED]: 3,
  [DeliveryStatus.CANCELED]: 4,
  [DeliveryStatus.FAILED]: 4
};

function normalizeStatus(value?: string): DeliveryStatus | null {
  if (!value) {
    return null;
  }

  for (const rule of STATUS_RULES) {
    if (rule.pattern.test(value)) {
      return rule.status;
    }
  }

  return null;
}

function shouldPromoteStatus(current: DeliveryStatus, next: DeliveryStatus): boolean {
  if (current === next) {
    return false;
  }

  if (next === DeliveryStatus.CANCELED || next === DeliveryStatus.FAILED) {
    return true;
  }

  if (current === DeliveryStatus.CANCELED || current === DeliveryStatus.FAILED) {
    return false;
  }

  return STATUS_PRIORITY[next] >= STATUS_PRIORITY[current];
}

function parseTimestamp(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildTimestampUpdates(timestamps?: Record<string, string | undefined>): TimestampUpdates {
  if (!timestamps) {
    return {};
  }

  const updates: TimestampUpdates = {};

  for (const [key, value] of Object.entries(timestamps)) {
    const parsed = parseTimestamp(value);
    if (!parsed) {
      continue;
    }

    const rule = TIMESTAMP_RULES.find(({ pattern }) => pattern.test(key));
    if (rule) {
      updates[rule.field] = parsed;
    }
  }

  return updates;
}

function buildMetadata(
  existing: Prisma.JsonValue | null | undefined,
  update: DeliveryUpdateJobData
): Prisma.InputJsonValue {
  const base = (existing && typeof existing === 'object' ? existing : {}) as Record<string, unknown>;

  return {
    ...base,
    provider: update.provider,
    status: update.status,
    timestamps: update.timestamps,
    rawPayload: update.rawPayload
  } satisfies Record<string, unknown> as Prisma.InputJsonValue;
}

export function createDeliveryUpdateJob(prisma: PrismaClient) {
  return async function handle(job: Job<DeliveryUpdateJobData>): Promise<void> {
    const update = job.data;

    if (!update?.externalJobId) {
      throw new Error('externalJobId is required to process delivery updates');
    }

    await prisma.$transaction(async (tx) => {
      const deliveryJob = await tx.deliveryJob.findUnique({
        where: { externalJobId: update.externalJobId }
      });

      if (!deliveryJob) {
        throw new Error(`Delivery job ${update.externalJobId} not found`);
      }

      const nextStatus = normalizeStatus(update.status ?? '');
      const timestampUpdates = buildTimestampUpdates(update.timestamps);
      const metadata = buildMetadata(deliveryJob.metadata, update);

      const data: Prisma.DeliveryJobUpdateInput = {
        metadata
      };

      if (update.trackingUrl) {
        data.trackingUrl = update.trackingUrl;
      }

      if (nextStatus && shouldPromoteStatus(deliveryJob.status, nextStatus)) {
        data.status = nextStatus;
      }

      for (const [field, value] of Object.entries(timestampUpdates)) {
        if (value) {
          (data as Record<string, unknown>)[field] = value;
        }
      }

      await tx.deliveryJob.update({
        where: { id: deliveryJob.id },
        data
      });

      if (update.proof?.url) {
        const existingProof = await tx.proof.findFirst({
          where: { deliveryJobId: deliveryJob.id, url: update.proof.url }
        });

        if (!existingProof) {
          await tx.proof.create({
            data: {
              deliveryJobId: deliveryJob.id,
              url: update.proof.url,
              type: update.proof.type ?? 'unknown'
            }
          });
        }
      }
    });
  };
}
