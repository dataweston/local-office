import { NextRequest, NextResponse } from 'next/server';

import { MENU_LOOKUP } from '../../../paikka/menu';

type CheckoutRequest = {
  items: Array<{ sku: 'SMOKED_CHICKEN' | 'PUMPKIN_ROMESCO'; qty: number }>;
  customer: {
    firstName: string;
    lastName?: string;
    email: string;
  };
  tipCents: number;
};

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ?? 'http://localhost:3000';

const encodeState = (payload: object) => Buffer.from(JSON.stringify(payload)).toString('base64url');

const parsePayload = async (request: NextRequest): Promise<CheckoutRequest> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    throw new Error('Invalid JSON payload.');
  }

  if (typeof body !== 'object' || body === null) {
    throw new Error('Invalid request body.');
  }

  const items = Array.isArray((body as any).items) ? (body as any).items : [];
  if (!items.length) {
    throw new Error('At least one item is required.');
  }

  const parsedItems = items.map((item: any) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid item payload.');
    }
    const sku = item.sku as CheckoutRequest['items'][number]['sku'];
    const qty = Number(item.qty);
    if (!MENU_LOOKUP.has(sku)) {
      throw new Error('Unsupported SKU.');
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error('Invalid quantity.');
    }
    return { sku, qty };
  });

  const customer = (body as any).customer ?? {};
  const firstName = typeof customer.firstName === 'string' ? customer.firstName.trim() : '';
  const lastName = typeof customer.lastName === 'string' ? customer.lastName.trim() : undefined;
  const email = typeof customer.email === 'string' ? customer.email.trim() : '';

  if (!firstName) {
    throw new Error('First name is required.');
  }
  if (!email || !/.+@.+/.test(email)) {
    throw new Error('A valid email is required.');
  }

  const tipCentsRaw = Number((body as any).tipCents ?? 0);
  const tipCents = Number.isFinite(tipCentsRaw) && tipCentsRaw > 0 ? Math.round(tipCentsRaw) : 0;

  return {
    items: parsedItems,
    customer: { firstName, lastName, email },
    tipCents
  };
};

export async function POST(request: NextRequest) {
  try {
    const payload = await parsePayload(request);

    const state = encodeState({
      email: payload.customer.email,
      firstName: payload.customer.firstName,
      lastName: payload.customer.lastName,
      items: payload.items,
      tipCents: payload.tipCents
    });

    const redirectUrl = new URL('/paikka/success', PUBLIC_BASE_URL);
    redirectUrl.searchParams.set('state', state);

    const squareItems = payload.items.map((item) => {
      const menuItem = MENU_LOOKUP.get(item.sku);
      if (!menuItem) {
        throw new Error('Unsupported SKU.');
      }
      return {
        sku: item.sku,
        name: menuItem.squareName,
        unit: menuItem.presalePriceCents,
        qty: item.qty
      };
    });

    const response = await fetch(`${API_BASE_URL}/square/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: squareItems,
        tipCents: payload.tipCents,
        redirectUrl: redirectUrl.toString()
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      return NextResponse.json({ error: details?.error ?? 'Unable to start Square checkout.' }, { status: 502 });
    }

    const data = (await response.json()) as { checkout_url?: string; checkoutUrl?: string };
    const checkoutUrl = data.checkout_url ?? data.checkoutUrl;
    if (!checkoutUrl) {
      return NextResponse.json({ error: 'Square did not return a checkout URL.' }, { status: 502 });
    }

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to start checkout.' },
      { status: 400 }
    );
  }
}
