import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { order, jwt } = body ?? {};
  if (!order || typeof jwt !== 'string' || jwt.length === 0) {
    return NextResponse.json({ error: 'Missing order or token.' }, { status: 400 });
  }

  const response = await fetch(`${API_BASE_URL}/brevo/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ order, jwt }),
    cache: 'no-store'
  });

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    return NextResponse.json({ error: details?.error ?? 'Unable to resend email.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
