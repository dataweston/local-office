'use client';

import { format, formatDistanceToNowStrict, isBefore } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@local-office/ui';

import { useApiClient } from '../../lib/api-client';
import type { components } from '../../lib/api-schema';
import { useAuth } from '../../lib/auth-context';

const DEFAULT_ORG = 'demo-org';
const DEFAULT_USER = 'employee-001';

const emptyOrderForm = {
  programSlotId: '',
  skuId: '',
  quantity: 1,
  notes: ''
};

type Program = components['schemas']['Program'];
type ProgramSlot = components['schemas']['ProgramSlot'];
type Order = components['schemas']['Order'];

type UpcomingProgram = {
  program: Program;
  nextSlot: ProgramSlot | null;
};

export default function EmployeePage() {
  const { isAuthenticated } = useAuth();
  const client = useApiClient();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderForm, setOrderForm] = useState({ ...emptyOrderForm, userId: DEFAULT_USER });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setPrograms([]);
      setOrders([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [programRes, orderRes] = await Promise.all([
          client.get<components['schemas']['ProgramListResponse']>('/v1/programs', { query: { org: DEFAULT_ORG } }),
          client.get<components['schemas']['OrderListResponse']>('/v1/orders', { query: { org: DEFAULT_ORG } })
        ]);

        if (cancelled) return;

        setPrograms(programRes.data ?? []);
        setOrders(orderRes.data ?? []);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load programs';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [client, isAuthenticated]);

  const upcoming = useMemo<UpcomingProgram[]>(() => {
    const now = new Date();
    return programs.map((program) => {
      const nextSlot = [...(program.slots ?? [])]
        .sort((a, b) => new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime())
        .find((slot) => !isBefore(new Date(slot.windowEnd), now));

      return { program, nextSlot: nextSlot ?? null };
    });
  }, [programs]);

  const handleOrderSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!orderForm.programSlotId || !orderForm.skuId) {
      setFormError('Select a program slot and menu item.');
      return;
    }

    const targetProgram = programs.find((program) => program.slots?.some((slot) => slot.id === orderForm.programSlotId));
    const slot = targetProgram?.slots?.find((item) => item.id === orderForm.programSlotId) ?? null;

    if (!slot) {
      setFormError('Unable to locate the selected program slot.');
      return;
    }

    if (isBefore(new Date(slot.cutoffAt), new Date())) {
      setFormError('The order window has closed for this slot.');
      return;
    }

    const optimisticId = crypto.randomUUID();
    const basePrice = 16;
    const subtotal = basePrice * orderForm.quantity;
    const optimisticOrder: Order = {
      id: optimisticId,
      programSlotId: orderForm.programSlotId,
      userId: orderForm.userId ?? DEFAULT_USER,
      batchId: null,
      status: 'PENDING',
      subtotal,
      tip: 0,
      loyaltyDiscount: 0,
      referralCredit: 0,
      paymentFee: 0,
      total: subtotal,
      items: [
        {
          id: crypto.randomUUID(),
          orderId: optimisticId,
          skuId: orderForm.skuId,
          quantity: orderForm.quantity,
          modifiers: undefined,
          notes: orderForm.notes || undefined
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setSubmitting(true);
    setOrders((current) => [optimisticOrder, ...current]);

    try {
      const persisted = await client.post<Order>('/v1/orders', {
        body: {
          programSlotId: orderForm.programSlotId,
          userId: orderForm.userId ?? DEFAULT_USER,
          notes: orderForm.notes || undefined,
          items: [
            {
              skuId: orderForm.skuId,
              quantity: orderForm.quantity,
              notes: orderForm.notes || undefined
            }
          ]
        },
        headers: { 'Idempotency-Key': optimisticId }
      });

      setOrders((current) =>
        current.map((existing) => (existing.id === optimisticId ? persisted : existing))
      );

      setOrderForm({ ...emptyOrderForm, userId: orderForm.userId });
      setFormSuccess('Order submitted! We saved your preferences for next time.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not submit order.';
      setFormError(message);
      setOrders((current) => current.filter((order) => order.id !== optimisticId));
    } finally {
      setSubmitting(false);
    }
  };

  const cutoffCopy = (slot: ProgramSlot | null) => {
    if (!slot) return 'No upcoming service scheduled.';
    const cutoff = new Date(slot.cutoffAt);
    const now = new Date();
    if (isBefore(cutoff, now)) {
      return `Ordering closed ${formatDistanceToNowStrict(cutoff, { addSuffix: true })}.`;
    }

    const distance = formatDistanceToNowStrict(cutoff, { addSuffix: true });
    return `Place orders before ${format(cutoff, "MMM d, h:mma")} (${distance}).`;
  };

  const slotOptions = useMemo(() => {
    return programs.flatMap((program) =>
      (program.slots ?? []).map((slot) => ({
        value: slot.id,
        label: `${program.name} · ${format(new Date(slot.serviceDate), 'MMM d h:mma')}`
      }))
    );
  }, [programs]);

  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <Badge variant="outline">Employee experience</Badge>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Meal ordering without the chaos.</h1>
        <p className="max-w-2xl text-slate-600">
          The employee portal keeps ordering under the 48-hour cutoff, surfaces dietary guidance, and handles payment in a
          single flow.
        </p>
      </header>

      {!isAuthenticated ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect to the API</CardTitle>
            <CardDescription>Sign in with a bearer token to preview live data for your programs.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Use the sign-in button in the header and supply the demo token (<code>demo-token</code>) to explore the sample
              dataset.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">We hit a snag</CardTitle>
            <CardDescription className="text-red-600">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2">
        {upcoming.map(({ program, nextSlot }) => (
          <Card key={program.id} className="h-full">
            <CardHeader>
              <CardTitle>{program.name}</CardTitle>
              <CardDescription>{program.cadence}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>{cutoffCopy(nextSlot)}</p>
              {nextSlot ? (
                <p>
                  Service window:{' '}
                  <span className="font-medium text-slate-700">
                    {format(new Date(nextSlot.windowStart), 'MMM d, h:mma')}–{format(new Date(nextSlot.windowEnd), 'h:mma')}
                  </span>
                </p>
              ) : null}
              <p>Subsidy: {program.subsidyRules ? 'Custom subsidy active' : 'Standard pricing'}</p>
              <p>Cutoff: {program.cutoffHours} hours before service.</p>
            </CardContent>
          </Card>
        ))}
        {upcoming.length === 0 && isAuthenticated && !loading ? (
          <Card>
            <CardHeader>
              <CardTitle>No programs yet</CardTitle>
              <CardDescription>Ask an admin to configure a program so you can begin ordering meals.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Place an order</CardTitle>
            <CardDescription>Orders respect the 48-hour cutoff and the 50-item maximum per batch.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOrderSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="employee-program-slot"
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Program slot
                </label>
                <select
                  id="employee-program-slot"
                  value={orderForm.programSlotId}
                  onChange={(event) => setOrderForm((current) => ({ ...current, programSlotId: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select an upcoming slot</option>
                  {slotOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="employee-sku"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Menu item SKU
                  </label>
                  <input
                    id="employee-sku"
                    value={orderForm.skuId}
                    onChange={(event) => setOrderForm((current) => ({ ...current, skuId: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="salad-bowl"
                  />
                </div>
                <div>
                  <label
                    htmlFor="employee-quantity"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Quantity
                  </label>
                  <input
                    id="employee-quantity"
                    type="number"
                    min={1}
                    max={50}
                    value={orderForm.quantity}
                    onChange={(event) =>
                      setOrderForm((current) => ({ ...current, quantity: Number(event.target.value) || 1 }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="employee-notes"
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Order notes
                </label>
                <textarea
                  id="employee-notes"
                  value={orderForm.notes}
                  onChange={(event) => setOrderForm((current) => ({ ...current, notes: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="No onions, please"
                  rows={3}
                />
              </div>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              {formSuccess ? <p className="text-sm text-green-600">{formSuccess}</p> : null}
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Square securely stores payment preferences for repeat orders.</p>
                <Button type="submit" disabled={isSubmitting || !isAuthenticated}>
                  {isSubmitting ? 'Submitting…' : 'Submit order'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <CardDescription>Monitor status changes as orders move to batches and delivery.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading your orders…</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-slate-500">No orders yet. Submit one to see it appear instantly.</p>
            ) : (
              <ul className="space-y-3">
                {orders.map((order) => {
                  const slot = programs
                    .flatMap((program) => program.slots ?? [])
                    .find((item) => item.id === order.programSlotId);
                  return (
                    <li key={order.id} className="rounded-md border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{order.items?.[0]?.skuId ?? 'Custom order'}</span>
                        <span className="text-xs uppercase tracking-wide text-slate-500">{order.status}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>
                          Placed {formatDistanceToNowStrict(new Date(order.createdAt), { addSuffix: true })}
                        </span>
                        {slot ? <span>@ {format(new Date(slot.serviceDate), 'MMM d h:mma')}</span> : null}
                        <span>Total ${order.total.toFixed(2)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
