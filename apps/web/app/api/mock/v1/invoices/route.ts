import { NextRequest } from 'next/server';

import { ensureAuth, getDb, json } from '../_lib/store';

export async function GET(request: NextRequest) {
  const authError = ensureAuth(request);
  if (authError) return authError;

  const db = getDb();
  const searchParams = request.nextUrl.searchParams;
  const org = searchParams.get('org');
  const period = searchParams.get('period');

  const filtered = db.invoices.filter((invoice) => {
    if (org && invoice.orgId !== org) return false;
    if (period && invoice.period !== period) return false;
    return true;
  });

  return json({ data: filtered, nextCursor: null });
}
