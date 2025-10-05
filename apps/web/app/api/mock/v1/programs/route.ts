import { NextRequest } from 'next/server';

import {
  badRequest,
  ensureAuth,
  getDb,
  json,
  type Program,
  type ProgramSlotInput,
  type ProgramUpsertRequest
} from '../_lib/store';

type ProgramSlot = NonNullable<Program['slots']>[number];

function toProgramSlot(programId: string, slot: ProgramSlotInput) {
  return {
    id: slot.id ?? crypto.randomUUID(),
    programId,
    providerId: slot.providerId,
    serviceDate: slot.serviceDate,
    windowStart: slot.windowStart,
    windowEnd: slot.windowEnd,
    cutoffAt: slot.cutoffAt
  } as ProgramSlot;
}

export async function GET(request: NextRequest) {
  const authError = ensureAuth(request);
  if (authError) return authError;

  const db = getDb();
  const searchParams = request.nextUrl.searchParams;
  const org = searchParams.get('org');
  const site = searchParams.get('site');

  const filtered = db.programs.filter((program) => {
    if (org && program.orgId !== org) return false;
    if (site && program.siteId !== site) return false;
    return true;
  });

  return json({ data: filtered, nextCursor: null });
}

export async function POST(request: NextRequest) {
  const authError = ensureAuth(request);
  if (authError) return authError;

  const payload = (await request.json()) as ProgramUpsertRequest;

  if (!payload.orgId || !payload.siteId || !payload.name || !payload.cadence || !payload.orderingWindow) {
    return badRequest('Missing required program fields.');
  }

  const db = getDb();
  const now = new Date();
  const programId = payload.id ?? crypto.randomUUID();
  const existing = db.programs.find((program) => program.id === programId);

  const slots = (payload.slots ?? []).map((slot) => toProgramSlot(programId, slot));

  if (existing) {
    existing.name = payload.name;
    existing.cadence = payload.cadence;
    existing.orderingWindow = payload.orderingWindow;
    existing.subsidyRules = payload.subsidyRules ?? existing.subsidyRules;
    existing.cutoffHours = payload.cutoffHours ?? existing.cutoffHours;
    existing.loyaltyRequired = payload.loyaltyRequired ?? existing.loyaltyRequired;
    if (slots.length > 0) {
      existing.slots = slots;
    }
    existing.updatedAt = now.toISOString();
    return json(existing, 200);
  }

  const program: Program = {
    id: programId,
    orgId: payload.orgId,
    siteId: payload.siteId,
    name: payload.name,
    cadence: payload.cadence,
    orderingWindow: payload.orderingWindow,
    subsidyRules: payload.subsidyRules ?? undefined,
    cutoffHours: payload.cutoffHours ?? 48,
    loyaltyRequired: payload.loyaltyRequired ?? false,
    slots,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  db.programs.unshift(program);

  return json(program, 201);
}

