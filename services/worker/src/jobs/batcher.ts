import type { Job } from 'bullmq';
import type { PrismaClient } from '@local-office/db';
import { BatchStatus, OrderStatus } from '@local-office/db';

export interface BatcherJobData {
  programSlotId?: string;
}

export interface BatchSummary {
  programSlotId: string;
  batchId: string;
  lockedCount: number;
  batchedCount: number;
}

export function createBatcherJob(prisma: PrismaClient) {
  return async function handleBatcher(job: Job<BatcherJobData>): Promise<BatchSummary[]> {
    const { programSlotId } = job.data ?? {};

    return prisma.$transaction(async (tx) => {
      const slotIds = programSlotId
        ? [programSlotId]
        : (
            await tx.programSlot.findMany({
              where: {
                cutoffAt: { lte: new Date() },
                orders: {
                  some: {
                    status: { in: [OrderStatus.PENDING, OrderStatus.LOCKED] },
                    batchId: null
                  }
                }
              },
              select: { id: true }
            })
          ).map((slot) => slot.id);

      const summaries: BatchSummary[] = [];

      for (const slotId of slotIds) {
        const slot = await tx.programSlot.findUnique({
          where: { id: slotId },
          include: {
            program: {
              select: { siteId: true, orgId: true }
            }
          }
        });

        if (!slot) {
          continue;
        }

        const locked = await tx.order.updateMany({
          where: {
            programSlotId: slotId,
            status: OrderStatus.PENDING
          },
          data: { status: OrderStatus.LOCKED }
        });

        const batch = await tx.batch.upsert({
          where: {
            siteId_providerId_programSlotId: {
              siteId: slot.program.siteId,
              providerId: slot.providerId,
              programSlotId: slotId
            }
          },
          update: {
            status: BatchStatus.LOCKED
          },
          create: {
            programSlotId: slotId,
            siteId: slot.program.siteId,
            providerId: slot.providerId,
            orgId: slot.program.orgId,
            status: BatchStatus.LOCKED
          }
        });

        const batched = await tx.order.updateMany({
          where: {
            programSlotId: slotId,
            status: OrderStatus.LOCKED,
            batchId: null
          },
          data: {
            batchId: batch.id,
            status: OrderStatus.BATCHED
          }
        });

        summaries.push({
          programSlotId: slotId,
          batchId: batch.id,
          lockedCount: locked.count,
          batchedCount: batched.count
        });
      }

      return summaries;
    });
  };
}
