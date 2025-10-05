'use client';

import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@local-office/ui';

import { useApiClient } from '../../lib/api-client';
import type { components } from '../../lib/api-schema';
import { useAuth } from '../../lib/auth-context';

const DEFAULT_ORG = 'demo-org';
const DEFAULT_SITE = 'hq-sf';

const emptyProgramForm = {
  name: '',
  cadence: 'Weekly rotation',
  orderingWindow: '9a-1p',
  cutoffHours: 48,
  subsidyRules: '',
  providerId: '',
  serviceDate: '',
  windowStart: '',
  windowEnd: ''
};

type Program = components['schemas']['Program'];
type ProgramSlot = components['schemas']['ProgramSlot'];
type Invoice = components['schemas']['Invoice'];
type Order = components['schemas']['Order'];

type AdminProgram = Program & { nextSlot: ProgramSlot | null };

type ProgramFormState = typeof emptyProgramForm & { siteId: string; orgId: string };

export default function AdminPage() {
  const { isAuthenticated } = useAuth();
  const client = useApiClient();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState<ProgramFormState>({ ...emptyProgramForm, siteId: DEFAULT_SITE, orgId: DEFAULT_ORG });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setPrograms([]);
      setInvoices([]);
      setOrders([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [programRes, invoiceRes, orderRes] = await Promise.all([
          client.get<components['schemas']['ProgramListResponse']>('/v1/programs', { query: { org: DEFAULT_ORG } }),
          client.get<components['schemas']['InvoiceListResponse']>('/v1/invoices', { query: { org: DEFAULT_ORG } }),
          client.get<components['schemas']['OrderListResponse']>('/v1/orders', { query: { org: DEFAULT_ORG } })
        ]);

        if (cancelled) return;

        setPrograms(programRes.data ?? []);
        setInvoices(invoiceRes.data ?? []);
        setOrders(orderRes.data ?? []);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load admin data.';
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [client, isAuthenticated]);

  const decoratedPrograms = useMemo<AdminProgram[]>(() => {
    const now = new Date();
    return programs.map((program) => {
      const nextSlot = [...(program.slots ?? [])]
        .sort((a, b) => new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime())
        .find((slot) => new Date(slot.windowEnd) > now);
      return { ...program, nextSlot: nextSlot ?? null };
    });
  }, [programs]);

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === 'PENDING'),
    [orders]
  );

  const handleProgramSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!form.name || !form.providerId || !form.serviceDate || !form.windowStart || !form.windowEnd) {
      setFormError('Provide a name, provider, and full service window.');
      return;
    }

    const slot: components['schemas']['ProgramSlotInput'] = {
      providerId: form.providerId,
      serviceDate: new Date(form.serviceDate).toISOString(),
      windowStart: new Date(form.windowStart).toISOString(),
      windowEnd: new Date(form.windowEnd).toISOString(),
      cutoffAt: new Date(new Date(form.serviceDate).getTime() - form.cutoffHours * 60 * 60 * 1000).toISOString()
    };

    const optimisticId = crypto.randomUUID();
    const optimisticProgram: Program = {
      id: optimisticId,
      orgId: form.orgId,
      siteId: form.siteId,
      name: form.name,
      cadence: form.cadence,
      orderingWindow: form.orderingWindow,
      subsidyRules: form.subsidyRules ? { note: form.subsidyRules } : undefined,
      cutoffHours: form.cutoffHours,
      loyaltyRequired: false,
      slots: [
        {
          id: crypto.randomUUID(),
          programId: optimisticId,
          providerId: slot.providerId,
          serviceDate: slot.serviceDate,
          windowStart: slot.windowStart,
          windowEnd: slot.windowEnd,
          cutoffAt: slot.cutoffAt
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setSaving(true);
    setPrograms((current) => [optimisticProgram, ...current]);

    try {
      const saved = await client.post<Program>('/v1/programs', {
        body: {
          orgId: form.orgId,
          siteId: form.siteId,
          name: form.name,
          cadence: form.cadence,
          orderingWindow: form.orderingWindow,
          subsidyRules: optimisticProgram.subsidyRules,
          cutoffHours: form.cutoffHours,
          loyaltyRequired: false,
          slots: [slot]
        },
        headers: { 'Idempotency-Key': optimisticId }
      });

      setPrograms((current) =>
        current.map((program) => (program.id === optimisticId ? saved : program))
      );

      setFormSuccess('Program saved successfully. Providers and employees now see the new cadence.');
      setForm({ ...emptyProgramForm, siteId: form.siteId, orgId: form.orgId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save the program.';
      setFormError(message);
      setPrograms((current) => current.filter((program) => program.id !== optimisticId));
    } finally {
      setSaving(false);
    }
  };

  const confirmOrder = async (orderId: string) => {
    setApproving(orderId);
    try {
      const confirmation = await client.post<components['schemas']['OrderConfirmationResponse']>(
        `/v1/orders/${orderId}/confirm`,
        {
          headers: { 'Idempotency-Key': crypto.randomUUID() }
        }
      );
      setOrders((current) =>
        current.map((existing) => (existing.id === orderId ? confirmation.order : existing))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to confirm order.';
      setError(message);
    } finally {
      setApproving(null);
    }
  };

  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <Badge>Laptop ready</Badge>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Control programs, budgets, and credits.</h1>
        <p className="max-w-2xl text-slate-600">
          Admins tailor subsidies, manage loyalty tiers, and resolve incidents with automation-friendly tooling.
        </p>
        <Button variant="outline">Connect Square</Button>
      </header>

      {!isAuthenticated ? (
        <Card>
          <CardHeader>
            <CardTitle>Authenticate to manage programs</CardTitle>
            <CardDescription>Use the header sign-in button to load demo data.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Once authenticated you can create programs, approve pending orders, and review billing snapshots backed by the
              `/v1` API.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Something went wrong</CardTitle>
            <CardDescription className="text-red-600">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Program builder</CardTitle>
            <CardDescription>Define cadence, providers, subsidies, and the 48-hour cutoff per program or site.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProgramSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="admin-program-name"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Program name
                  </label>
                  <input
                    id="admin-program-name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="Thursday Olo ordering"
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin-provider"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Provider ID
                  </label>
                  <input
                    id="admin-provider"
                    value={form.providerId}
                    onChange={(event) => setForm((current) => ({ ...current, providerId: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="provider-olo"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-cadence" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cadence
                  </label>
                  <input
                    id="admin-cadence"
                    value={form.cadence}
                    onChange={(event) => setForm((current) => ({ ...current, cadence: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="Weekly rotation"
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin-window"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Ordering window
                  </label>
                  <input
                    id="admin-window"
                    value={form.orderingWindow}
                    onChange={(event) => setForm((current) => ({ ...current, orderingWindow: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="9a-1p"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-cutoff" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cutoff hours
                  </label>
                  <input
                    id="admin-cutoff"
                    type="number"
                    min={1}
                    value={form.cutoffHours}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, cutoffHours: Number(event.target.value) || 48 }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin-subsidy"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Subsidy rule
                  </label>
                  <input
                    id="admin-subsidy"
                    value={form.subsidyRules}
                    onChange={(event) => setForm((current) => ({ ...current, subsidyRules: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="$15 per head"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="admin-service-date"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Service date
                  </label>
                  <input
                    id="admin-service-date"
                    type="datetime-local"
                    value={form.serviceDate}
                    onChange={(event) => setForm((current) => ({ ...current, serviceDate: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin-window-start"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Window start
                  </label>
                  <input
                    id="admin-window-start"
                    type="datetime-local"
                    value={form.windowStart}
                    onChange={(event) => setForm((current) => ({ ...current, windowStart: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="admin-window-end"
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Window end
                </label>
                <input
                  id="admin-window-end"
                  type="datetime-local"
                  value={form.windowEnd}
                  onChange={(event) => setForm((current) => ({ ...current, windowEnd: event.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              {formSuccess ? <p className="text-sm text-green-600">{formSuccess}</p> : null}
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">We generate manifests and invoices automatically once orders lock.</p>
                <Button type="submit" disabled={saving || !isAuthenticated}>
                  {saving ? 'Saving...' : 'Save program'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active programs</CardTitle>
            <CardDescription>Review slots, subsidies, and the next cutoff at a glance.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading programs...</p>
            ) : decoratedPrograms.length === 0 ? (
              <p className="text-sm text-slate-500">No programs yet. Use the form to create one.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {decoratedPrograms.map((program) => (
                  <li key={program.id} className="rounded-md border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{program.name}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{program.cadence}</p>
                      </div>
                      <span className="text-xs text-slate-500">Cutoff {program.cutoffHours}h</span>
                    </div>
                    {program.nextSlot ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Next slot {format(parseISO(program.nextSlot.serviceDate), 'MMM d h:mma')} - cutoff{' '}
                        {formatDistanceToNowStrict(parseISO(program.nextSlot.cutoffAt), { addSuffix: true })}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No upcoming slots scheduled.</p>
                    )}
                    {program.subsidyRules ? (
                      <p className="mt-2 text-xs text-slate-600">Subsidy: {JSON.stringify(program.subsidyRules)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pending approvals</CardTitle>
            <CardDescription>Confirm employee orders before the cutoff to lock batches.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingOrders.length === 0 ? (
              <p className="text-sm text-slate-500">No approvals pending. Employees are keeping pace with the cutoff.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {pendingOrders.map((order) => (
                  <li key={order.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{order.items?.[0]?.skuId ?? 'Custom order'}</p>
                        <p className="text-xs text-slate-500">{order.items?.[0]?.quantity ?? 1} items - {order.total.toFixed(2)}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => confirmOrder(order.id)}
                        disabled={approving === order.id}
                      >
                        {approving === order.id ? 'Confirming...' : 'Confirm order'}
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Placed {formatDistanceToNowStrict(new Date(order.createdAt), { addSuffix: true })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Financial clarity across delivery fees, subsidies, and tips.</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-slate-500">No invoices found for {DEFAULT_ORG}.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {invoices.map((invoice) => {
                  const {
                    deliveryTotal = 0,
                    tipsTotal = 0,
                    discountsTotal = 0,
                    paymentFees = 0
                  } = invoice;

                  return (
                    <li key={invoice.id} className="rounded-md border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-800">Invoice {invoice.id}</p>
                          <p className="text-xs text-slate-500">
                            Period {invoice.period} - {format(parseISO(invoice.periodStart), 'MMM d')} -{' '}
                            {format(parseISO(invoice.periodEnd), 'MMM d')}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-slate-800">${invoice.total.toFixed(2)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-500 sm:grid-cols-3">
                        <span>Delivery ${(invoice.deliveryTotal ?? 0).toFixed(2)}</span>
                        <span>Tips ${(invoice.tipsTotal ?? 0).toFixed(2)}</span>
                        <span>Discounts ${(invoice.discountsTotal ?? 0).toFixed(2)}</span>
                        <span>Fees ${(invoice.paymentFees ?? 0).toFixed(2)}</span>
                        <span>Status {invoice.status}</span>
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
