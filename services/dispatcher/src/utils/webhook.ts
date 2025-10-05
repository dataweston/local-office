import type { Request } from 'express';

export function getHeader(req: Request, name: string): string | undefined {
  const header =
    req.get?.(name) ??
    (req.headers?.[name] as string | undefined) ??
    (req.headers?.[name.toLowerCase()] as string | undefined) ??
    undefined;

  return header;
}

export function getRawBody(req: Request): string | undefined {
  const raw = (req as any).rawBody;
  if (typeof raw === 'string') {
    return raw;
  }

  if (Buffer.isBuffer(raw)) {
    return raw.toString('utf8');
  }

  return undefined;
}

export function normalizeTimestamps(input: Record<string, any> | undefined): Record<string, string | undefined> {
  if (!input) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value != null ? String(value) : undefined])
  );
}
