import { NextRequest } from 'next/server';

import { ensureAuth, getDb, json } from '../_lib/store';

export async function GET(request: NextRequest) {
  const authError = ensureAuth(request);
  if (authError) return authError;

  const db = getDb();
  const searchParams = request.nextUrl.searchParams;
  const org = searchParams.get('org');
  const providerId = searchParams.get('providerId');
  const status = searchParams.get('status');

  const filtered = db.batches.filter((batch) => {
    if (org && batch.orgId !== org) return false;
    if (providerId && batch.providerId !== providerId) return false;
    if (status && batch.status !== status) return false;
    return true;
  });

  return json({ data: filtered, nextCursor: null });
}
