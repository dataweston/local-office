import { NextRequest } from 'next/server';

import { buildManifest, ensureAuth, getDb, json, notFound } from '../../../_lib/store';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = ensureAuth(request);
  if (authError) return authError;

  const batchId = params.id;
  const db = getDb();
  const batch = db.batches.find((record) => record.id === batchId);
  if (!batch) {
    return notFound('Batch not found.');
  }

  const manifest = buildManifest(batch, db.orders);
  return json(manifest, 200);
}
