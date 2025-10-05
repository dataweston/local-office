'use client';

import { useMemo } from 'react';

import { useAuth } from './auth-context';

export class ApiError extends Error {
  constructor(message: string, public status: number, public payload?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | boolean | undefined | null;

type RequestOptions = {
  query?: Record<string, QueryValue>;
  headers?: HeadersInit;
  body?: unknown;
};

type ApiClient = {
  get: <T>(path: string, options?: RequestOptions) => Promise<T>;
  post: <T>(path: string, options?: RequestOptions) => Promise<T>;
};

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const target = trimmedBase.startsWith('http')
    ? `${trimmedBase}${normalizedPath}`
    : `${trimmedBase}${normalizedPath}`;

  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = trimmedBase.startsWith('http')
    ? new URL(target)
    : new URL(target, origin);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.append(key, String(value));
    }
  }
  return url.toString();
}

function createClient(baseUrl: string, token: string | null): ApiClient {
  const request = async <T>(method: string, path: string, options?: RequestOptions): Promise<T> => {
    const url = buildUrl(baseUrl, path, options?.query);
    const headers: HeadersInit = {
      Accept: 'application/json',
      ...(options?.headers ?? {})
    };

    const init: RequestInit = { method, headers };

    if (token) {
      init.headers = { ...headers, Authorization: `Bearer ${token}` };
    }

    if (options?.body !== undefined) {
      init.body = JSON.stringify(options.body);
      init.headers = { 'Content-Type': 'application/json', ...(init.headers ?? {}) };
    }

    const response = await fetch(url, init);
    const contentType = response.headers.get('content-type') ?? '';
    let payload: unknown = undefined;

    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else if (response.status !== 204) {
      payload = await response.text();
    }

    if (!response.ok) {
      let message = response.statusText;
      if (payload && typeof payload === 'object') {
        const maybeMessage = (payload as Record<string, unknown>).message ?? (payload as Record<string, unknown>).error;
        if (typeof maybeMessage === 'string') {
          message = maybeMessage;
        }
      } else if (typeof payload === 'string' && payload.trim().length > 0) {
        message = payload;
      }

      throw new ApiError(message, response.status, payload);
    }

    return payload as T;
  };

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options)
  };
}

export function useApiClient(): ApiClient {
  const { token, baseUrl } = useAuth();

  return useMemo(() => createClient(baseUrl, token), [baseUrl, token]);
}
