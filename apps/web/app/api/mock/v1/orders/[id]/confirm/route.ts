import { NextRequest } from 'next/server';

import {
  badRequest,
  ensureAuth,
  getDb,
  json,
  setOrderStatus,
  type OrderConfirmationResponse
} from '../../../_lib/store';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = ensureAuth(request);
  if (authError) return authError;

  const orderId = params.id;
  if (!orderId) {
    return badRequest('Missing order id.');
  }

  const order = setOrderStatus(orderId, 'LOCKED');
  if (!order) {
    return badRequest('Order not found.');
  }

  const response: OrderConfirmationResponse = {
    order,
    payment: {
      provider: 'square',
      clientSecret: `mock-secret-${orderId}`,
      methodOptions: { captureMethod: 'automatic' }
    }
  };

  const db = getDb();
  const batch = db.batches.find((candidate) => candidate.programSlotId === order.programSlotId);
  if (batch && !batch.manifestUrl) {
    batch.manifestUrl = `https://example.com/manifest/${batch.id}.pdf`;
    batch.updatedAt = new Date().toISOString();
  }

  return json(response, 200);
}
