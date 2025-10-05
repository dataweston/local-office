import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, Prisma } from '@local-office/db';
import { assertBeforeCutoff, calculateOrderTotals, sumLineItems, toDecimal } from '@local-office/lib';

import { BillingService } from '@local-office/billing';
import { PrismaService } from '../prisma/prisma.service';
import { BatchLockProducer } from '../batch-lock.producer';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';

const SUCCESSFUL_PAYMENT_STATUSES = new Set(['APPROVED', 'COMPLETED']);

function parseDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly batchLockProducer: BatchLockProducer
  ) {}

  async create(dto: CreateOrderDto) {
    const totalQuantity = dto.items.reduce((acc, item) => acc + (item.quantity ?? 1), 0);
    if (totalQuantity > 50) {
      throw new BadRequestException('MAX_GROUP_SIZE_EXCEEDED');
    }

    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: true }
      });
      if (existing) {
        return existing;
      }
    }

    const [user, programSlot] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
      this.prisma.programSlot.findUnique({
        where: { id: dto.programSlotId },
        include: { program: true }
      })
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!programSlot) {
      throw new NotFoundException('Program slot not found');
    }

    assertBeforeCutoff(programSlot.cutoffAt);

    const skuIds = [...new Set(dto.items.map((item) => item.skuId))];
    const skus = await this.prisma.sku.findMany({
      where: { id: { in: skuIds } }
    });

    if (skus.length !== skuIds.length) {
      throw new BadRequestException('SKU_NOT_FOUND');
    }

    const skuMap = new Map(skus.map((sku) => [sku.id, sku]));

    const subtotal = sumLineItems(
      dto.items.map((item) => ({
        price: skuMap.get(item.skuId)?.price ?? new Prisma.Decimal(0),
        quantity: item.quantity ?? 1
      }))
    );

    const totals = calculateOrderTotals({ subtotal, tip: dto.tip ?? 0 });

    return this.prisma.order.create({
      data: {
        programSlotId: dto.programSlotId,
        userId: dto.userId,
        status: OrderStatus.PENDING,
        subtotal: totals.subtotal,
        tip: totals.tip,
        loyaltyDiscount: totals.loyaltyDiscount,
        referralCredit: totals.referralCredit,
        paymentFee: totals.paymentFee,
        total: totals.total,
        idempotencyKey: dto.idempotencyKey,
        items: {
          create: dto.items.map((item) => ({
            skuId: item.skuId,
            quantity: item.quantity ?? 1,
            modifiers: item.modifiers ?? undefined,
            notes: item.notes ?? undefined
          }))
        }
      },
      include: {
        items: true
      }
    });
  }

  async confirm(id: string, dto: ConfirmOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        programSlot: true,
        payment: true
      }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      return {
        order,
        payment: order.payment ?? undefined
      };
    }

    assertBeforeCutoff(order.programSlot.cutoffAt);

    const tipOverride = dto.tipOverride !== undefined ? toDecimal(dto.tipOverride) : order.tip;
    const total = calculateOrderTotals({ subtotal: order.subtotal, tip: tipOverride });

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.LOCKED,
        tip: tipOverride,
        total: total.total
      },
      include: {
        items: true
      }
    });

    const paymentResult = await this.billing.createPayment({
      amount: Number(total.total.toString()),
      currency: 'USD',
      customerId: order.userId,
      sourceId: dto.paymentIntentId ?? `square_${id}`,
      idempotencyKey: dto.idempotencyKey ?? `order_${id}`
    });

    const paymentMethod = (dto.paymentMethod ?? PaymentMethod.ACH) as PaymentMethod;

    const paymentReceivedAt =
      parseDate(paymentResult.completedAt) ??
      parseDate(paymentResult.approvedAt) ??
      (SUCCESSFUL_PAYMENT_STATUSES.has(paymentResult.status ?? '') ? new Date() : null);

    const payment = await this.prisma.payment.create({
      data: {
        orderId: id,
        squarePaymentId: paymentResult.id,
        method: paymentMethod,
        amount: toDecimal(paymentResult.amount ?? total.total),
        feeAmount: order.paymentFee,
        status: paymentResult.status,
        receivedAt: paymentReceivedAt,
        rawResponse: paymentResult.rawResponse as Prisma.InputJsonValue
      }
    });

    await this.batchLockProducer.enqueueLock({
      orderId: order.id,
      programSlotId: order.programSlotId,
      cutoffAt: order.programSlot.cutoffAt.toISOString(),
      idempotencyKey: dto.idempotencyKey
    });

    return {
      order: {
        ...updated,
        programSlot: order.programSlot,
        payment
      },
      payment
    };
  }
}
