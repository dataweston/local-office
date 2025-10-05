import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdapterRegistry,
  CourierAdapter,
  CreateJobRequest,
  QuoteRequest
} from '@local-office/dispatcher';
import { DeliveryStatus } from '@local-office/db';
import type { Queue } from 'bullmq';

import { PrismaService } from '../prisma/prisma.service';
import {
  DELIVERY_ADAPTERS,
  DELIVERY_UPDATE_JOB_NAME,
  DELIVERY_UPDATES_QUEUE
} from './deliveries.constants';
import type { CreateDeliveryDto } from './dto/create-delivery.dto';
import type { QuoteDeliveryDto } from './dto/quote-delivery.dto';

interface DeliveryUpdateJobData {
  provider: string;
  externalJobId: string;
  status?: string;
  timestamps?: Record<string, string | undefined>;
  proof?: { url: string; type?: string };
  trackingUrl?: string | null;
  rawPayload: unknown;
}

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DELIVERY_ADAPTERS) private readonly adapters: AdapterRegistry,
    @Inject(DELIVERY_UPDATES_QUEUE)
    private readonly deliveryUpdatesQueue: Queue<DeliveryUpdateJobData>
  ) {}

  async quote(batchId: string, dto: QuoteDeliveryDto) {
    await this.ensureBatchExists(batchId);
    const adapter = this.getAdapter(dto.adapter);
    return adapter.quote(this.toQuoteRequest(dto));
  }

  async create(batchId: string, dto: CreateDeliveryDto) {
    await this.ensureBatchExists(batchId);
    const adapter = this.getAdapter(dto.adapter);
    const result = await adapter.create(this.toCreateRequest(dto));

    if (!result.externalJobId) {
      throw new BadRequestException('DELIVERY_JOB_ID_MISSING');
    }

    const trackingUrl = result.trackingUrl ?? null;

    const deliveryJob = await this.prisma.deliveryJob.upsert({
      where: { batchId },
      create: {
        batchId,
        adapter: dto.adapter,
        externalJobId: result.externalJobId,
        trackingUrl,
        status: DeliveryStatus.REQUESTED
      },
      update: {
        adapter: dto.adapter,
        externalJobId: result.externalJobId,
        trackingUrl,
        status: DeliveryStatus.REQUESTED
      }
    });

    await this.deliveryUpdatesQueue.add(
      DELIVERY_UPDATE_JOB_NAME,
      {
        provider: dto.adapter,
        externalJobId: result.externalJobId,
        status: 'requested',
        trackingUrl,
        rawPayload: { source: 'api.deliveries.create', batchId }
      },
      {
        jobId: `delivery:${result.externalJobId}`,
        removeOnComplete: true,
        removeOnFail: 100
      }
    );

    return deliveryJob;
  }

  async cancel(batchId: string) {
    const deliveryJob = await this.prisma.deliveryJob.findUnique({ where: { batchId } });

    if (!deliveryJob) {
      throw new NotFoundException('Delivery job not found');
    }

    if (!deliveryJob.externalJobId) {
      throw new BadRequestException('DELIVERY_JOB_EXTERNAL_ID_MISSING');
    }

    const adapter = this.getAdapter(deliveryJob.adapter);
    await adapter.cancel(deliveryJob.externalJobId);

    const updated = await this.prisma.deliveryJob.update({
      where: { id: deliveryJob.id },
      data: {
        status: DeliveryStatus.CANCELED,
        canceledAt: new Date()
      }
    });

    await this.deliveryUpdatesQueue.add(
      DELIVERY_UPDATE_JOB_NAME,
      {
        provider: deliveryJob.adapter,
        externalJobId: deliveryJob.externalJobId,
        status: 'canceled',
        rawPayload: { source: 'api.deliveries.cancel', batchId }
      },
      {
        jobId: `delivery:${deliveryJob.externalJobId}:cancel`,
        removeOnComplete: true,
        removeOnFail: 100
      }
    );

    return updated;
  }

  private getAdapter(name: string): CourierAdapter {
    const adapter = this.adapters?.[name];
    if (!adapter) {
      throw new BadRequestException(`Unsupported delivery adapter: ${name}`);
    }

    return adapter;
  }

  private async ensureBatchExists(batchId: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id: batchId }, select: { id: true } });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }
  }

  private toQuoteRequest(dto: QuoteDeliveryDto): QuoteRequest {
    return {
      pickupAddress: dto.pickupAddress,
      dropoffAddress: dto.dropoffAddress,
      readyAt: dto.readyAt,
      reference: dto.reference
    };
  }

  private toCreateRequest(dto: CreateDeliveryDto): CreateJobRequest {
    return {
      ...this.toQuoteRequest(dto),
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone
    };
  }
}
