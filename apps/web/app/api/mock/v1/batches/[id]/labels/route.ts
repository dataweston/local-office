import { NextRequest } from 'next/server';

import {
  ensureAuth,
  getDb,
  json,
  notFound,
  type LabelGenerationResponse
} from '../../../_lib/store';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = ensureAuth(request);
  if (authError) return authError;

  const batchId = params.id;
  const db = getDb();
  const batch = db.batches.find((record) => record.id === batchId);
  if (!batch) {
    return notFound('Batch not found.');
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const payload: LabelGenerationResponse = {
    batchId,
    pdfUrl: `https://example.com/labels/${batchId}.pdf`,
    zplUrl: `https://example.com/labels/${batchId}.zpl`,
    expiresAt
  };

  return json(payload, 202);
}
