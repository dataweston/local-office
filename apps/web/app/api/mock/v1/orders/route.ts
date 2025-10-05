import { NextRequest } from 'next/server';

import {
  badRequest,
  conflict,
  ensureAuth,
  getDb,
  json,
  type CreateOrderRequest,
  type Order
} from '../_lib/store';

function findProgramOrgForSlot(programs: ReturnType<typeof getDb>['programs'], slotId: string) {
  return programs.find((program) => program.slots?.some((slot) => slot.id === slotId));
}

export async function GET(request: NextRequest) {
  const authError = ensureAuth(request);
  if (authError) return authError;

  const db = getDb();
  const searchParams = request.nextUrl.searchParams;
  const org = searchParams.get('org');
  const programSlotId = searchParams.get('programSlotId');
  const status = searchParams.get('status');

  const filtered = db.orders.filter((order) => {
    if (programSlotId && order.programSlotId !== programSlotId) return false;
    if (status && order.status !== status) return false;
    if (org) {
      const program = findProgramOrgForSlot(db.programs, order.programSlotId);
      if (!program || program.orgId !== org) return false;
    }
    return true;
  });

  return json({ data: filtered, nextCursor: null });
}

export async function POST(request: NextRequest) {
  const authError = ensureAuth(request);
  if (authError) return authError;

  const payload = (await request.json()) as CreateOrderRequest;

  if (!payload.programSlotId || !payload.userId || !payload.items || payload.items.length === 0) {
    return badRequest('Orders require a program slot, user, and at least one item.');
  }

  const db = getDb();
  const program = findProgramOrgForSlot(db.programs, payload.programSlotId);
  if (!program) {
    return badRequest('Program slot not found.');
  }

  const slot = program.slots?.find((item) => item.id === payload.programSlotId);
  if (!slot) {
    return badRequest('Program slot not found.');
  }

  if (new Date(slot.cutoffAt) < new Date()) {
    return conflict('Ordering window is closed for this slot.');
  }

  const totalQuantity = payload.items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity > 50) {
    return conflict('Quantity exceeds the batch maximum of 50 items.');
  }

  const basePrice = 16;
  const subtotal = payload.items.reduce((sum, item) => sum + item.quantity * basePrice, 0);
  const orderId = crypto.randomUUID();

  const order: Order = {
    id: orderId,
    programSlotId: payload.programSlotId,
    userId: payload.userId,
    batchId: null,
    status: 'PENDING',
    subtotal,
    tip: payload.tip ?? 0,
    loyaltyDiscount: 0,
    referralCredit: 0,
    paymentFee: subtotal * 0.05,
    total: subtotal + (payload.tip ?? 0),
    items: payload.items.map((item) => ({
      id: crypto.randomUUID(),
      orderId,
      skuId: item.skuId,
      quantity: item.quantity,
      modifiers: item.modifiers ?? undefined,
      notes: item.notes ?? undefined
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.orders.unshift(order);

  return json(order, 201);
}
