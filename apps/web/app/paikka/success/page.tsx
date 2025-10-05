import Link from 'next/link';
import type { Metadata } from 'next';

import type { Order } from '../../../lib/types';

import { formatCurrency, MENU_LOOKUP } from '../menu';
import { ResendEmailButton } from '../resend-email-button';

type SearchParams = Record<string, string | string[] | undefined>;

type CheckoutState = {
  email: string;
  firstName: string;
  lastName?: string;
  items: Array<{ sku: 'SMOKED_CHICKEN' | 'PUMPKIN_ROMESCO'; qty: number }>;
  tipCents?: number;
};

type OrderResponse = {
  order: Order;
  jwt: string;
  created?: boolean;
};

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

const decodeState = (value: string): CheckoutState => {
  const buffer = Buffer.from(value, 'base64url');
  const parsed = JSON.parse(buffer.toString('utf8')) as CheckoutState;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid state payload');
  }
  if (!Array.isArray(parsed.items)) {
    throw new Error('Invalid item payload');
  }
  return {
    email: String(parsed.email ?? ''),
    firstName: String(parsed.firstName ?? ''),
    lastName: typeof parsed.lastName === 'string' && parsed.lastName.trim() ? parsed.lastName : undefined,
    items: parsed.items
      .map((item) => ({
        sku: item.sku,
        qty: Number(item.qty)
      }))
      .filter((item): item is { sku: CheckoutState['items'][number]['sku']; qty: number } =>
        (item.sku === 'SMOKED_CHICKEN' || item.sku === 'PUMPKIN_ROMESCO') && Number.isFinite(item.qty) && item.qty > 0
      ),
    tipCents: Number.isFinite(parsed.tipCents) && parsed.tipCents ? Number(parsed.tipCents) : 0
  };
};

const paymentReferenceKeys = [
  'transactionId',
  'transaction_id',
  'paymentId',
  'payment_id',
  'checkoutId',
  'checkout_id',
  'orderId',
  'order_id'
] as const;

const resolvePaymentReference = (searchParams: SearchParams) => {
  for (const key of paymentReferenceKeys) {
    const value = searchParams[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    if (Array.isArray(value) && value[0]) {
      return value[0];
    }
  }
  return undefined;
};

const finalizeOrder = async (state: CheckoutState, paymentReference: string): Promise<OrderResponse> => {
  const response = await fetch(`${API_BASE_URL}/orders/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: state.email,
      firstName: state.firstName,
      lastName: state.lastName,
      items: state.items,
      paymentReference,
      tipCents: state.tipCents ?? 0
    }),
    cache: 'no-store'
  });

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details?.error ?? 'Unable to finalize order.');
  }

  return (await response.json()) as OrderResponse;
};

const computeTotals = (state: CheckoutState) => {
  const subtotal = state.items.reduce((sum, item) => {
    const menu = MENU_LOOKUP.get(item.sku);
    if (!menu) return sum;
    return sum + menu.presalePriceCents * item.qty;
  }, 0);

  const tip = state.tipCents ?? 0;
  return {
    subtotal,
    tip,
    total: subtotal + tip
  };
};

export const metadata: Metadata = {
  title: 'Paikka presale — success',
  description: 'Square checkout confirmation for the Paikka sandwich presale.'
};

export default async function SuccessPage({ searchParams }: { searchParams: SearchParams }) {
  const stateParam = typeof searchParams.state === 'string' ? searchParams.state : undefined;
  const paymentReference = resolvePaymentReference(searchParams);

  let state: CheckoutState | null = null;
  let orderResult: OrderResponse | null = null;
  let error: string | null = null;

  try {
    if (!stateParam) {
      throw new Error('Missing checkout state.');
    }
    state = decodeState(stateParam);
    if (state.items.length === 0) {
      throw new Error('No items found in checkout.');
    }
    if (!paymentReference) {
      throw new Error('Missing payment reference from Square.');
    }

    orderResult = await finalizeOrder(state, paymentReference);
  } catch (err) {
    error = err instanceof Error ? err.message : 'We could not confirm your order.';
  }

  const totals = state ? computeTotals(state) : { subtotal: 0, tip: 0, total: 0 };

  return (
    <div className="mx-auto max-w-2xl space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      {orderResult && !error ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900">You&apos;re all set.</h1>
            <p className="text-slate-600">
              We emailed your QR code to <span className="font-medium">{orderResult.order.email}</span>. Show the QR or
              the backup code at pickup to skip the line.
            </p>
          </div>

          <div className="space-y-4 rounded-xl bg-slate-50 p-5">
            <div className="flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium text-slate-900">Order ID</span>
              <span>{orderResult.order.oid}</span>
            </div>
            <div className="flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium text-slate-900">Backup code</span>
              <span className="font-mono text-base text-slate-900">{orderResult.order.jti}</span>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Items</p>
              <ul className="space-y-1">
                {state?.items.map((item) => {
                  const menu = MENU_LOOKUP.get(item.sku);
                  if (!menu) return null;
                  return (
                    <li key={item.sku} className="flex justify-between">
                      <span>
                        {menu.title} × {item.qty}
                      </span>
                      <span>{formatCurrency(menu.presalePriceCents * item.qty)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Gratuity</span>
              <span>{formatCurrency(totals.tip)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-slate-900">
              <span>Total paid</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>

          <ResendEmailButton order={orderResult.order} jwt={orderResult.jwt} />

          <div className="flex flex-col gap-2 text-sm text-slate-600">
            <span>
              Need help? Email <a className="text-brand-700" href="mailto:hello@localoffice.co">hello@localoffice.co</a>.
            </span>
            <Link href="/paikka" className="text-brand-700 hover:underline">
              Back to presale
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold text-slate-900">We couldn&apos;t confirm your order.</h1>
          <p className="text-slate-600">{error ?? 'Something went wrong while finalizing your order.'}</p>
          <p className="text-sm text-slate-600">
            Reach out to <a className="text-brand-700" href="mailto:hello@localoffice.co">hello@localoffice.co</a> with your
            payment receipt and we&apos;ll get you squared away.
          </p>
          <Link href="/paikka" className="text-brand-700 hover:underline">
            Return to presale
          </Link>
        </div>
      )}
    </div>
  );
}
