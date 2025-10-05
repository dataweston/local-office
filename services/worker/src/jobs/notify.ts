import type { Job } from 'bullmq';
import type { PrismaClient } from '@local-office/db';
import { OrderStatus } from '@local-office/db';

import { getLogger } from '../utils/logging';

const logger = getLogger();

type Channel = 'email' | 'sms';

export interface NotifyJobData {
  orderId?: string;
  channels?: Channel[];
  template?: string;
  limit?: number;
}

export interface NotificationPayload {
  orderId: string;
  channel: Channel;
  template?: string;
  recipient: string;
  context: Record<string, unknown>;
}

export interface NotificationResult {
  orderId: string;
  sent: NotificationPayload[];
}

export interface NotificationClient {
  sendEmail(payload: NotificationPayload): Promise<void>;
  sendSms?(payload: NotificationPayload): Promise<void>;
}

export function createDefaultNotificationClient(): NotificationClient {
  return {
    async sendEmail(payload) {
      logger.info({ ...payload }, 'email notification dispatched');
    },
    async sendSms(payload) {
      logger.info({ ...payload }, 'sms notification dispatched');
    }
  };
}

export function createNotifyJob(prisma: PrismaClient, client: NotificationClient = createDefaultNotificationClient()) {
  async function processOrder(orderId: string, channels: Channel[], template?: string): Promise<NotificationResult> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        programSlot: {
          include: { program: true }
        }
      }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const context = {
      program: order.programSlot.program.name,
      serviceDate: order.programSlot.serviceDate?.toISOString?.() ?? new Date().toISOString(),
      total: order.total.toString()
    };

    const sent: NotificationPayload[] = [];

    for (const channel of channels) {
      if (channel === 'email' && order.user?.email) {
        const payload: NotificationPayload = {
          orderId,
          channel,
          template,
          recipient: order.user.email,
          context
        };
        await client.sendEmail(payload);
        sent.push(payload);
      }

      if (channel === 'sms' && order.user?.phone && client.sendSms) {
        const payload: NotificationPayload = {
          orderId,
          channel,
          template,
          recipient: order.user.phone,
          context
        };
        await client.sendSms(payload);
        sent.push(payload);
      }
    }

    if (sent.length) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.FULFILLED }
      });
    }

    return { orderId, sent };
  }

  return async function handleNotify(job: Job<NotifyJobData>): Promise<NotificationResult[]> {
    const { orderId, channels = ['email'], template, limit = 20 } = job.data ?? {};

    const orderIds = orderId
      ? [orderId]
      : (
          await prisma.order.findMany({
            where: { status: OrderStatus.BATCHED },
            select: { id: true },
            take: limit
          })
        ).map((order) => order.id);

    const results: NotificationResult[] = [];
    for (const id of orderIds) {
      results.push(await processOrder(id, channels, template));
    }

    return results;
  };
}
