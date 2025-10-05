import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { OrderStatus, PaymentMethod, Prisma } from '@local-office/db';

import { OrdersService } from './orders.service';
import { ConfirmOrderDto } from './dto/confirm-order.dto';

const cutoffAt = new Date('2099-01-01T12:00:00Z');

describe('OrdersService.confirm', () => {
  const baseOrder = {
    id: 'order-1',
    programSlotId: 'slot-1',
    userId: 'user-1',
    status: OrderStatus.PENDING,
    subtotal: new Prisma.Decimal(25),
    tip: new Prisma.Decimal(0),
    loyaltyDiscount: new Prisma.Decimal(0),
    referralCredit: new Prisma.Decimal(0),
    paymentFee: new Prisma.Decimal(0),
    total: new Prisma.Decimal(25),
    idempotencyKey: 'order-1',
    items: [],
    programSlot: {
      id: 'slot-1',
      cutoffAt
    },
    payment: null
  } as const;

  let prisma: any;
  let billing: any;
  let batchLockProducer: any;
  let service: OrdersService;

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: mock.fn(),
        update: mock.fn()
      },
      payment: {
        create: mock.fn()
      }
    };

    billing = {
      createPayment: mock.fn()
    };

    batchLockProducer = {
      enqueueLock: mock.fn()
    };

    service = new OrdersService(prisma, billing, batchLockProducer);
  });

  it('creates a Square payment, stores it, and schedules a batch lock', async () => {
    const dto: ConfirmOrderDto = {
      paymentMethod: 'CARD',
      tipOverride: 5,
      idempotencyKey: 'idem-123'
    };

    const updatedOrder = {
      ...baseOrder,
      status: OrderStatus.LOCKED,
      tip: new Prisma.Decimal(5),
      total: new Prisma.Decimal(30),
      items: []
    };

    const paymentResult = {
      id: 'square-payment-1',
      status: 'COMPLETED',
      amount: 30,
      currency: 'USD',
      approvedAt: '2024-01-01T12:04:00Z',
      rawResponse: { id: 'square-payment-1', status: 'COMPLETED' }
    } as const;

    const paymentRecord = {
      id: 'payment-1',
      orderId: baseOrder.id,
      squarePaymentId: paymentResult.id,
      method: PaymentMethod.CARD,
      amount: new Prisma.Decimal(30),
      feeAmount: baseOrder.paymentFee,
      status: paymentResult.status,
      receivedAt: new Date('2024-01-01T12:05:00Z'),
      rawResponse: paymentResult.rawResponse
    };

    prisma.order.findUnique.mock.mockImplementation(async () => baseOrder);
    prisma.order.update.mock.mockImplementation(async () => updatedOrder);
    billing.createPayment.mock.mockImplementation(async () => paymentResult);
    prisma.payment.create.mock.mockImplementation(async () => paymentRecord);
    batchLockProducer.enqueueLock.mock.mockImplementation(async () => undefined);

    const result = await service.confirm(baseOrder.id, dto);

    assert.equal(billing.createPayment.mock.callCount(), 1);
    assert.deepEqual(billing.createPayment.mock.calls[0].arguments[0], {
      amount: 30,
      currency: 'USD',
      customerId: baseOrder.userId,
      sourceId: `square_${baseOrder.id}`,
      idempotencyKey: dto.idempotencyKey
    });

    assert.equal(prisma.payment.create.mock.callCount(), 1);
    const paymentArgs = prisma.payment.create.mock.calls[0].arguments[0];
    assert.equal(paymentArgs.data.orderId, baseOrder.id);
    assert.equal(paymentArgs.data.squarePaymentId, paymentResult.id);
    assert.equal(paymentArgs.data.method, PaymentMethod.CARD);
    assert.equal(paymentArgs.data.amount.toString(), new Prisma.Decimal(30).toString());
    assert.equal(paymentArgs.data.feeAmount.toString(), baseOrder.paymentFee.toString());
    assert.equal(paymentArgs.data.status, paymentResult.status);
    assert.ok(paymentArgs.data.receivedAt instanceof Date);
    assert.deepEqual(paymentArgs.data.rawResponse, paymentResult.rawResponse);

    assert.equal(batchLockProducer.enqueueLock.mock.callCount(), 1);
    assert.deepEqual(batchLockProducer.enqueueLock.mock.calls[0].arguments[0], {
      orderId: baseOrder.id,
      programSlotId: baseOrder.programSlotId,
      cutoffAt: baseOrder.programSlot.cutoffAt.toISOString(),
      idempotencyKey: dto.idempotencyKey
    });

    assert.deepEqual(result.payment, paymentRecord);
    assert.equal(result.order.status, OrderStatus.LOCKED);
    assert.deepEqual(result.order.payment, paymentRecord);
    assert.deepEqual(result.order.programSlot, baseOrder.programSlot);
  });

  it('returns existing payment when the order is already confirmed', async () => {
    const lockedOrder = {
      ...baseOrder,
      status: OrderStatus.LOCKED,
      payment: {
        id: 'payment-existing',
        squarePaymentId: 'square-existing',
        method: PaymentMethod.ACH
      }
    };

    prisma.order.findUnique.mock.mockImplementation(async () => lockedOrder);

    const result = await service.confirm(baseOrder.id, {});

    assert.equal(billing.createPayment.mock.callCount(), 0);
    assert.equal(prisma.order.update.mock.callCount(), 0);
    assert.equal(batchLockProducer.enqueueLock.mock.callCount(), 0);
    assert.deepEqual(result.order, lockedOrder);
    assert.deepEqual(result.payment, lockedOrder.payment);
  });
});
