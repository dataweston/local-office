import type { AxiosError } from 'axios';
import { isAxiosError } from 'axios';

export class AdapterHttpError extends Error {
  readonly provider: string;
  readonly status?: number;
  readonly code?: string;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(provider: string, message: string, options: {
    status?: number;
    code?: string;
    retryable?: boolean;
    details?: unknown;
  } = {}) {
    super(`[${provider}] ${message}`);
    this.name = 'AdapterHttpError';
    this.provider = provider;
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export function translateAxiosError(provider: string, error: unknown): AdapterHttpError {
  if (isAxiosError(error)) {
    return fromAxiosError(provider, error);
  }

  if (error instanceof Error) {
    return new AdapterHttpError(provider, error.message, { details: { stack: error.stack } });
  }

  return new AdapterHttpError(provider, 'Unknown error', { details: error });
}

function fromAxiosError(provider: string, error: AxiosError): AdapterHttpError {
  const status = error.response?.status;
  const message =
    (typeof error.response?.data === 'object' && error.response?.data !== null && 'message' in (error.response?.data as any)
      ? String((error.response?.data as any).message)
      : error.message) ?? 'HTTP request failed';

  const retryable = determineRetryable(error);

  return new AdapterHttpError(provider, message, {
    status,
    code: error.code,
    retryable,
    details: {
      data: error.response?.data,
      headers: error.response?.headers,
      requestId: (error.response?.headers as Record<string, string> | undefined)?.['x-request-id']
    }
  });
}

function determineRetryable(error: AxiosError): boolean {
  if (!error.response) {
    return true;
  }

  const status = error.response.status ?? 0;
  return status >= 500 || status === 429;
}
