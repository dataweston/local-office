import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';

import { PrismaService } from '../prisma/prisma.service';
import { LABELS_QUEUE } from './queues.constants';

interface LabelJobData {
  batchId: string;
}

export type LabelStatus = 'pending' | 'ready';

export interface BatchLabelsResponse {
  batchId: string;
  status: LabelStatus;
  pdfUrl: string | null;
  zplUrl: string | null;
  labels: Array<{
    id: string;
    orderId: string;
    name: string;
    item: string;
    allergens: string[];
    pdfUrl: string | null;
    zplUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export interface LabelJobAcceptedResponse {
  batchId: string;
  status: 'queued';
}

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LABELS_QUEUE) private readonly labelsQueue: Queue<LabelJobData>
  ) {}

  async manifest(id: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: {
        programSlot: {
          include: {
            program: {
              include: { site: true }
            },
            provider: true
          }
        },
        orders: {
          include: {
            items: {
              include: {
                sku: {
                  include: {
                    allergens: true
                  }
                }
              }
            },
            user: true
          }
        }
      }
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    return {
      id: batch.id,
      status: batch.status,
      deliveryFee: batch.deliveryFee,
      gratuity: batch.gratuity,
      programSlot: {
        id: batch.programSlot.id,
        serviceDate: batch.programSlot.serviceDate,
        windowStart: batch.programSlot.windowStart,
        windowEnd: batch.programSlot.windowEnd,
        provider: {
          id: batch.programSlot.provider.id,
          name: batch.programSlot.provider.name
        },
        program: {
          id: batch.programSlot.program.id,
          name: batch.programSlot.program.name,
          site: {
            id: batch.programSlot.program.site.id,
            name: batch.programSlot.program.site.name
          }
        }
      },
      orders: batch.orders.map((order) => ({
        id: order.id,
        user: {
          id: order.user.id,
          name: `${order.user.firstName} ${order.user.lastName}`
        },
        status: order.status,
        notes: order.items.flatMap((item) => (item.notes ? [item.notes] : [])),
        items: order.items.map((item) => ({
          id: item.id,
          name: item.sku.name,
          quantity: item.quantity,
          allergens: item.sku.allergens?.map((a) => a.allergenId) ?? []
        }))
      }))
    };
  }

  async requestLabels(id: string): Promise<LabelJobAcceptedResponse> {
    const batch = await this.prisma.batch.findUnique({ where: { id }, select: { id: true } });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    await this.labelsQueue.add(
      'generate-batch-labels',
      { batchId: id },
      {
        jobId: `batch-labels:${id}`,
        removeOnComplete: true,
        removeOnFail: true
      }
    );

    return { batchId: id, status: 'queued' };
  }

  async getLabels(id: string): Promise<BatchLabelsResponse> {
    const batch = await this.prisma.batch.findUnique({ where: { id }, select: { id: true } });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    const labels = await this.prisma.label.findMany({
      where: { batchId: id },
      orderBy: { createdAt: 'asc' }
    });

    if (!labels.length) {
      return {
        batchId: id,
        status: 'pending',
        pdfUrl: null,
        zplUrl: null,
        labels: []
      };
    }

    const pdfUrl = labels.find((label) => label.pdfUrl)?.pdfUrl ?? null;
    const zplUrl = labels.find((label) => label.zplUrl)?.zplUrl ?? null;

    return {
      batchId: id,
      status: pdfUrl && zplUrl ? 'ready' : 'pending',
      pdfUrl,
      zplUrl,
      labels: labels.map((label) => ({
        id: label.id,
        orderId: label.orderId,
        name: label.name,
        item: label.item,
        allergens: label.allergens,
        pdfUrl: label.pdfUrl ?? null,
        zplUrl: label.zplUrl ?? null,
        createdAt: label.createdAt,
        updatedAt: label.updatedAt
      }))
    };
  }
}
