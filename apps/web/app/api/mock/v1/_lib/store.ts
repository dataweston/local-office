import { NextResponse, type NextRequest } from 'next/server';

import type { components } from '../../../../../lib/api-schema';

const DEMO_TOKEN = 'demo-token';

export type Program = components['schemas']['Program'];
export type ProgramUpsertRequest = components['schemas']['ProgramUpsertRequest'];
export type ProgramSlotInput = components['schemas']['ProgramSlotInput'];
type ProgramSlot = NonNullable<Program['slots']>[number];
export type Order = components['schemas']['Order'];
export type CreateOrderRequest = components['schemas']['CreateOrderRequest'];
export type OrderConfirmationResponse = components['schemas']['OrderConfirmationResponse'];
export type Batch = components['schemas']['Batch'];
export type BatchManifest = components['schemas']['BatchManifest'];
export type Incident = components['schemas']['Incident'];
export type IncidentRequest = components['schemas']['IncidentRequest'];
export type Invoice = components['schemas']['Invoice'];
export type LabelGenerationResponse = components['schemas']['LabelGenerationResponse'];
export type OrderStatus = components['schemas']['OrderStatus'];

export type MockDb = {
  programs: Program[];
  orders: Order[];
  batches: Batch[];
  incidents: Incident[];
  invoices: Invoice[];
};

const globalStore = globalThis as typeof globalThis & { __LOCAL_OFFICE_DB__?: MockDb };

function iso(date: Date): string {
  return date.toISOString();
}

function hoursFrom(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function daysFrom(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function seedDb(): MockDb {
  const now = new Date();
  const programId = 'program-1';
  const secondProgramId = 'program-2';
  const slotOneDate = daysFrom(now, 2);
  const slotTwoDate = daysFrom(now, 5);
  const slotThreeDate = daysFrom(now, 3);

  const slot1 = {
    id: 'slot-1',
    programId,
    providerId: 'provider-olo',
    serviceDate: iso(slotOneDate),
    windowStart: iso(hoursFrom(slotOneDate, -2)),
    windowEnd: iso(hoursFrom(slotOneDate, 2)),
    cutoffAt: iso(hoursFrom(slotOneDate, -48))
  } as ProgramSlot;

  const slot2 = {
    id: 'slot-2',
    programId,
    providerId: 'provider-olo',
    serviceDate: iso(slotTwoDate),
    windowStart: iso(hoursFrom(slotTwoDate, -2)),
    windowEnd: iso(hoursFrom(slotTwoDate, 2)),
    cutoffAt: iso(hoursFrom(slotTwoDate, -48))
  } as ProgramSlot;

  const slot3 = {
    id: 'slot-3',
    programId: secondProgramId,
    providerId: 'provider-fare',
    serviceDate: iso(slotThreeDate),
    windowStart: iso(hoursFrom(slotThreeDate, -1)),
    windowEnd: iso(hoursFrom(slotThreeDate, 1)),
    cutoffAt: iso(hoursFrom(slotThreeDate, -24))
  } as ProgramSlot;

  const programs: Program[] = [
    {
      id: programId,
      orgId: 'demo-org',
      siteId: 'hq-sf',
      name: 'Tuesday Taco Bar',
      cadence: 'Weekly rotation',
      orderingWindow: '9a-1p',
      subsidyRules: { amount: 15 },
      cutoffHours: 48,
      loyaltyRequired: false,
      slots: [slot1, slot2],
      createdAt: iso(hoursFrom(now, -24)),
      updatedAt: iso(hoursFrom(now, -1))
    },
    {
      id: secondProgramId,
      orgId: 'demo-org',
      siteId: 'hq-sf',
      name: 'Friday Favorites',
      cadence: 'Bi-weekly',
      orderingWindow: '10a-2p',
      subsidyRules: undefined,
      cutoffHours: 24,
      loyaltyRequired: true,
      slots: [slot3],
      createdAt: iso(hoursFrom(now, -72)),
      updatedAt: iso(hoursFrom(now, -12))
    }
  ];

  const orders: Order[] = [
    {
      id: 'order-1',
      programSlotId: slot1.id,
      userId: 'employee-001',
      batchId: 'batch-1',
      status: 'PENDING',
      subtotal: 36,
      tip: 4,
      loyaltyDiscount: 0,
      referralCredit: 0,
      paymentFee: 1.5,
      total: 41.5,
      items: [
        {
          id: 'order-item-1',
          orderId: 'order-1',
          skuId: 'taco-bar',
          quantity: 3,
          modifiers: { salsa: 'verde' },
          notes: 'Extra napkins'
        }
      ],
      createdAt: iso(hoursFrom(now, -6)),
      updatedAt: iso(hoursFrom(now, -5))
    },
    {
      id: 'order-2',
      programSlotId: slot2.id,
      userId: 'employee-002',
      batchId: null,
      status: 'PENDING',
      subtotal: 18,
      tip: 0,
      loyaltyDiscount: 0,
      referralCredit: 0,
      paymentFee: 0.9,
      total: 18.9,
      items: [
        {
          id: 'order-item-2',
          orderId: 'order-2',
          skuId: 'salad-bowl',
          quantity: 1,
          modifiers: undefined,
          notes: undefined
        }
      ],
      createdAt: iso(hoursFrom(now, -2)),
      updatedAt: iso(hoursFrom(now, -2))
    }
  ];

  const batches: Batch[] = [
    {
      id: 'batch-1',
      programSlotId: slot1.id,
      siteId: 'hq-sf',
      providerId: 'provider-olo',
      orgId: 'demo-org',
      status: 'PENDING',
      deliveryFee: 25,
      gratuity: 10,
      manifestUrl: 'https://example.com/manifest/batch-1.pdf',
      labels: [],
      createdAt: iso(hoursFrom(now, -4)),
      updatedAt: iso(hoursFrom(now, -1))
    },
    {
      id: 'batch-2',
      programSlotId: slot3.id,
      siteId: 'hq-sf',
      providerId: 'provider-fare',
      orgId: 'demo-org',
      status: 'LOCKED',
      deliveryFee: 30,
      gratuity: 12,
      manifestUrl: null,
      labels: [],
      createdAt: iso(hoursFrom(now, -12)),
      updatedAt: iso(hoursFrom(now, -3))
    }
  ];

  const incidents: Incident[] = [
    {
      id: 'incident-1',
      orgId: 'demo-org',
      orderId: 'order-1',
      batchId: 'batch-1',
      deliveryJobId: null,
      category: 'QUALITY',
      severity: 'LOW',
      description: 'Slightly late courier arrival last week.',
      attachments: [],
      status: 'resolved',
      createdAt: iso(hoursFrom(now, -48)),
      updatedAt: iso(hoursFrom(now, -24))
    }
  ];

  const invoices: Invoice[] = [
    {
      id: 'inv-001',
      orgId: 'demo-org',
      period: 'WEEK',
      periodStart: iso(hoursFrom(now, -168)),
      periodEnd: iso(hoursFrom(now, 0)),
      subtotal: 520,
      deliveryTotal: 120,
      tipsTotal: 45,
      discountsTotal: 30,
      taxesTotal: 40,
      paymentFees: 18,
      total: 713,
      status: 'open',
      createdAt: iso(hoursFrom(now, -12)),
      updatedAt: iso(hoursFrom(now, -6))
    }
  ];

  return { programs, orders, batches, incidents, invoices };
}

export function getDb(): MockDb {
  if (!globalStore.__LOCAL_OFFICE_DB__) {
    globalStore.__LOCAL_OFFICE_DB__ = seedDb();
  }
  return globalStore.__LOCAL_OFFICE_DB__;
}

export function ensureAuth(request: NextRequest) {
  const header = request.headers.get('authorization');
  if (!header) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = header.replace(/Bearer\s+/i, '').trim();
  if (token !== DEMO_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function json<T>(data: T, init?: number | ResponseInit) {
  if (typeof init === 'number') {
    return NextResponse.json(data, { status: init });
  }
  return NextResponse.json(data, init);
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function buildManifest(batch: Batch, orders: Order[]): BatchManifest {
  const items = orders
    .filter((order) => order.programSlotId === batch.programSlotId)
    .flatMap((order) =>
      (order.items ?? []).map((item) => ({
        orderId: order.id,
        skuId: item.skuId,
        name: item.skuId.replace(/-/g, ' '),
        quantity: item.quantity,
        allergens: item.notes?.includes('onion') ? ['onion'] : []
      }))
    );

  return {
    batch,
    items
  };
}

export function setOrderStatus(orderId: string, status: OrderStatus) {
  const db = getDb();
  const order = db.orders.find((record) => record.id === orderId);
  if (!order) return null;
  order.status = status;
  order.updatedAt = iso(new Date());
  return order;
}

