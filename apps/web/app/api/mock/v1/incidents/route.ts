import { NextRequest } from 'next/server';

import {
  badRequest,
  ensureAuth,
  getDb,
  json,
  type Incident,
  type IncidentRequest
} from '../_lib/store';

export async function GET(request: NextRequest) {
  const authError = ensureAuth(request);
  if (authError) return authError;

  const db = getDb();
  const searchParams = request.nextUrl.searchParams;
  const org = searchParams.get('org');
  const status = searchParams.get('status');
  const severity = searchParams.get('severity');

  const filtered = db.incidents.filter((incident) => {
    if (org && incident.orgId !== org) return false;
    if (status && incident.status !== status) return false;
    if (severity && incident.severity !== severity) return false;
    return true;
  });

  return json({ data: filtered, nextCursor: null });
}

export async function POST(request: NextRequest) {
  const authError = ensureAuth(request);
  if (authError) return authError;

  const payload = (await request.json()) as (IncidentRequest & { orgId?: string });
  if (!payload.category || !payload.severity || !payload.description) {
    return badRequest('Incident requires a category, severity, and description.');
  }

  const db = getDb();
  const incident: Incident = {
    id: crypto.randomUUID(),
    orgId: payload.orgId ?? 'demo-org',
    orderId: payload.orderId ?? null,
    batchId: payload.batchId ?? null,
    deliveryJobId: payload.deliveryJobId ?? null,
    category: payload.category,
    severity: payload.severity,
    description: payload.description,
    attachments: payload.attachments ?? [],
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.incidents.unshift(incident);

  return json(incident, 201);
}

