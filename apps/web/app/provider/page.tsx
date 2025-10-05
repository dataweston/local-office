'use client';

import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@local-office/ui';

import { useApiClient } from '../../lib/api-client';
import type { components } from '../../lib/api-schema';
import { useAuth } from '../../lib/auth-context';

const DEFAULT_ORG = 'demo-org';
const DEFAULT_PROVIDER = 'provider-olo';

const incidentDefaults = {
  category: 'LATE' as components['schemas']['IncidentCategory'],
  severity: 'MEDIUM' as components['schemas']['IncidentSeverity'],
  description: '',
  orderId: '',
  batchId: ''
};

type Batch = components['schemas']['Batch'];
type Incident = components['schemas']['Incident'];
type BatchManifest = components['schemas']['BatchManifest'];

type ManifestState = {
  batchId: string | null;
  manifest: BatchManifest | null;
  error: string | null;
  loading: boolean;
  message: string | null;
};

export default function ProviderPage() {
  const { isAuthenticated } = useAuth();
  const client = useApiClient();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [manifestState, setManifestState] = useState<ManifestState>({
    batchId: null,
    manifest: null,
    error: null,
    loading: false,
    message: null
  });
  const [incidentForm, setIncidentForm] = useState(incidentDefaults);
  const [incidentFeedback, setIncidentFeedback] = useState<string | null>(null);
  const [incidentError, setIncidentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setBatches([]);
      setIncidents([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setManifestState((state) => ({ ...state, manifest: null, batchId: null, message: null, error: null }));
      try {
        const [batchRes, incidentRes] = await Promise.all([
          client.get<components['schemas']['BatchListResponse']>('/v1/batches', {
            query: { org: DEFAULT_ORG, providerId: DEFAULT_PROVIDER }
          }),
          client.get<components['schemas']['IncidentListResponse']>('/v1/incidents', { query: { org: DEFAULT_ORG } })
        ]);
        if (cancelled) return;
        setBatches(batchRes.data ?? []);
        setIncidents(incidentRes.data ?? []);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load batches.';
          setManifestState((state) => ({ ...state, error: message }));
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

  const upcomingBatches = useMemo(() => {
    return batches
      .slice()
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }, [batches]);

  const loadManifest = async (batchId: string) => {
    setManifestState({ batchId, manifest: null, error: null, loading: true, message: null });
    try {
      const manifest = await client.get<BatchManifest>(`/v1/batches/${batchId}/manifest`);
      setManifestState({ batchId, manifest, error: null, loading: false, message: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load manifest.';
      setManifestState({ batchId, manifest: null, error: message, loading: false, message: null });
    }
  };

  const generateLabels = async (batchId: string) => {
    try {
      const response = await client.post<components['schemas']['LabelGenerationResponse']>(
        `/v1/batches/${batchId}/labels`,
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      );
      setManifestState((state) => ({
        ...state,
        error: null,
        message: response ? `Labels ready - PDF ${response.pdfUrl}` : 'Labels queued successfully.'
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to queue label job.';
      setManifestState((state) => ({ ...state, error: message, message: null }));
    }
  };

  const submitIncident = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIncidentError(null);
    setIncidentFeedback(null);

    if (!incidentForm.description) {
      setIncidentError('Include a short description.');
      return;
    }

    try {
      const created = await client.post<Incident>('/v1/incidents', {
        body: {
          category: incidentForm.category,
          severity: incidentForm.severity,
          description: incidentForm.description,
          orderId: incidentForm.orderId || undefined,
          batchId: incidentForm.batchId || undefined
        },
        headers: { 'Idempotency-Key': crypto.randomUUID() }
      });

      setIncidents((current) => [created, ...current]);
      setIncidentFeedback('Incident logged. Ops will follow up within 15 minutes.');
      setIncidentForm(incidentDefaults);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to log the incident.';
      setIncidentError(message);
    }
  };

  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <Badge variant="warning">Provider console</Badge>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Clarity for every prep shift.</h1>
        <p className="max-w-2xl text-slate-600">
          Providers get a single queue of upcoming batches with quick access to manifests, labels, and courier updates.
        </p>
        <Button disabled={!isAuthenticated} onClick={() => (upcomingBatches[0] ? loadManifest(upcomingBatches[0].id) : null)}>
          View next manifest
        </Button>
      </header>

      {!isAuthenticated ? (
        <Card>
          <CardHeader>
            <CardTitle>Authenticate to see prep work</CardTitle>
            <CardDescription>Use the header sign-in button to load demo batches.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Once authenticated you can inspect manifests, generate labels, and file incidents directly against `/v1` endpoints.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming batches</CardTitle>
            <CardDescription>Keep manifests and labels within reach for the prep line.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading batches...</p>
            ) : upcomingBatches.length === 0 ? (
              <p className="text-sm text-slate-500">No batches assigned. Program slots will appear within 48 hours of service.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {upcomingBatches.map((batch) => (
                  <li key={batch.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">Batch {batch.id}</p>
                        <p className="text-xs text-slate-500">Provider {batch.providerId} - Delivery ${batch.deliveryFee.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => loadManifest(batch.id)}>
                          Manifest
                        </Button>
                        <Button size="sm" onClick={() => generateLabels(batch.id)}>
                          Labels
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Status {batch.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manifest preview</CardTitle>
          <CardDescription>Confirm counts and allergens before firing the line.</CardDescription>
        </CardHeader>
        <CardContent>
          {manifestState.message ? <p className="text-sm text-green-600">{manifestState.message}</p> : null}
          {manifestState.loading ? (
            <p className="text-sm text-slate-500">Loading manifest...</p>
          ) : manifestState.error ? (
            <p className="text-sm text-red-600">{manifestState.error}</p>
          ) : manifestState.manifest ? (
            <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">Batch {manifestState.manifest.batch.id}</p>
                  <p className="text-xs text-slate-500">
                    {manifestState.manifest.items.length} line items - Manifest URL{' '}
                    {manifestState.manifest.batch.manifestUrl ? (
                      <a className="text-brand-600" href={manifestState.manifest.batch.manifestUrl}>
                        Download
                      </a>
                    ) : (
                      'Pending'
                    )}
                  </p>
                </div>
                <ul className="space-y-2">
                  {manifestState.manifest.items.map((item) => (
                    <li key={item.orderId + item.skuId} className="rounded border border-slate-200 p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{item.name}</span>
                        <span className="text-xs text-slate-500">Qty {item.quantity}</span>
                      </div>
                      {item.allergens && item.allergens.length > 0 ? (
                        <p className="mt-1 text-xs text-amber-600">Allergens: {item.allergens.join(', ')}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a batch to preview the manifest.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Report an incident</CardTitle>
            <CardDescription>Escalate quality issues directly to operations.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitIncident} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="provider-incident-category"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Category
                  </label>
                  <select
                    id="provider-incident-category"
                    value={incidentForm.category}
                    onChange={(event) =>
                      setIncidentForm((current) => ({ ...current, category: event.target.value as typeof incidentForm.category }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="MISSING">Missing</option>
                    <option value="LATE">Late</option>
                    <option value="QUALITY">Quality</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="provider-incident-severity"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Severity
                  </label>
                  <select
                    id="provider-incident-severity"
                    value={incidentForm.severity}
                    onChange={(event) =>
                      setIncidentForm((current) => ({ ...current, severity: event.target.value as typeof incidentForm.severity }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="provider-incident-order"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Order ID
                  </label>
                  <input
                    id="provider-incident-order"
                    value={incidentForm.orderId}
                    onChange={(event) => setIncidentForm((current) => ({ ...current, orderId: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="provider-incident-batch"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Batch ID
                  </label>
                  <input
                    id="provider-incident-batch"
                    value={incidentForm.batchId}
                    onChange={(event) => setIncidentForm((current) => ({ ...current, batchId: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="provider-incident-description"
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Description
                </label>
                <textarea
                  id="provider-incident-description"
                  value={incidentForm.description}
                  onChange={(event) => setIncidentForm((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Describe the issue"
                />
              </div>
              {incidentError ? <p className="text-sm text-red-600">{incidentError}</p> : null}
              {incidentFeedback ? <p className="text-sm text-green-600">{incidentFeedback}</p> : null}
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Attach photos via the incident webhook for faster resolutions.</p>
                <Button type="submit" disabled={!isAuthenticated}>
                  Submit incident
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest incidents</CardTitle>
            <CardDescription>Track outstanding issues until they are resolved.</CardDescription>
          </CardHeader>
          <CardContent>
            {incidents.length === 0 ? (
              <p className="text-sm text-slate-500">No incidents logged. Keep up the great service!</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {incidents.map((incident) => (
                  <li key={incident.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{incident.category}</p>
                        <p className="text-xs text-slate-500">Severity {incident.severity}</p>
                      </div>
                      <span className="text-xs uppercase tracking-wide text-slate-500">{incident.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{incident.description}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Logged {formatDistanceToNowStrict(parseISO(incident.createdAt), { addSuffix: true })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

