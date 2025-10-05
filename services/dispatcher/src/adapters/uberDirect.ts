import axios, { type AxiosAdapter, AxiosInstance, isAxiosError } from 'axios';
import type { Request } from 'express';
import pino from 'pino';

import type {
  CourierAdapter,
  CreateJobRequest,
  CreateJobResponse,
  DeliveryUpdate,
  QuoteRequest,
  QuoteResponse
} from '..';
import { publishDeliveryUpdate, type DeliveryUpdatePublisher } from '../events/publisher';
import { AdapterHttpError, translateAxiosError } from '../utils/errors';
import { executeWithRetries } from '../utils/retry';
import { assertValidHmacSignature } from '../utils/signature';
import { getHeader, getRawBody, normalizeTimestamps } from '../utils/webhook';

const logger = pino({ name: 'uber-direct-adapter' });

interface UberDirectAdapterOptions {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  baseUrl?: string;
  authUrl?: string;
  scope?: string;
  publisher?: DeliveryUpdatePublisher;
  maxRetries?: number;
  retryDelayMs?: number;
  httpAdapter?: AxiosAdapter;
}

interface UberAccessToken {
  token: string;
  expiresAt: number;
}

export class UberDirectAdapter implements CourierAdapter {
  private readonly apiClient: AxiosInstance;
  private readonly authClient: AxiosInstance;
  private readonly webhookSecret: string;
  private readonly publish: DeliveryUpdatePublisher;
  private readonly scope: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private accessToken?: UberAccessToken;

  constructor(private readonly options: UberDirectAdapterOptions) {
    this.apiClient = axios.create({
      baseURL: options.baseUrl ?? 'https://api.uber.com/v1/direct-deliveries',
      timeout: 10000,
      adapter: options.httpAdapter
    });
    this.authClient = axios.create({
      baseURL: options.authUrl ?? 'https://login.uber.com',
      timeout: 10000,
      adapter: options.httpAdapter
    });
    this.webhookSecret = options.webhookSecret;
    this.publish = options.publisher ?? publishDeliveryUpdate;
    this.scope = options.scope ?? 'delivery';
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 100;
  }

  async quote(req: QuoteRequest): Promise<QuoteResponse> {
    logger.info({ req }, 'requesting Uber Direct quote');
    return executeWithRetries(async () => {
      const token = await this.getAccessToken();
      try {
        const { data } = await this.apiClient.post(
          '/quotes',
          {
            pickup: { address: req.pickupAddress },
            dropoff: { address: req.dropoffAddress },
            ready_by: req.readyAt,
            reference: req.reference
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        const fee = Number(data?.price?.amount ?? data?.fee ?? 0);
        const currency = String(data?.price?.currency ?? data?.currency ?? 'USD');
        const etaMinutes = Number(data?.eta?.minutes ?? data?.etaMinutes ?? 0);

        return { fee, currency, etaMinutes } satisfies QuoteResponse;
      } catch (error) {
        if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          this.accessToken = undefined;
          throw new AdapterHttpError('Uber Direct', 'Authentication failed', {
            status: error.response?.status,
            code: error.code,
            retryable: true,
            details: error.response?.data
          });
        }

        throw translateAxiosError('Uber Direct', error);
      }
    }, {
      retries: this.maxRetries,
      baseDelayMs: this.retryDelayMs,
      shouldRetry: (error) => error instanceof AdapterHttpError && error.retryable,
      onRetry: (error, attempt) => logger.warn({ error, attempt }, 'retrying Uber Direct quote request')
    });
  }

  async create(job: CreateJobRequest): Promise<CreateJobResponse> {
    logger.info({ job }, 'creating Uber Direct job');
    return executeWithRetries(async () => {
      const token = await this.getAccessToken();
      try {
        const { data } = await this.apiClient.post(
          '/deliveries',
          {
            pickup: { address: job.pickupAddress },
            dropoff: { address: job.dropoffAddress },
            ready_by: job.readyAt,
            reference: job.reference,
            contact: {
              email: job.contactEmail,
              phone: job.contactPhone
            }
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        return {
          externalJobId: String(data?.delivery_id ?? data?.id ?? ''),
          trackingUrl: data?.tracking_url ?? data?.trackingUrl
        } satisfies CreateJobResponse;
      } catch (error) {
        if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          this.accessToken = undefined;
          throw new AdapterHttpError('Uber Direct', 'Authentication failed', {
            status: error.response?.status,
            code: error.code,
            retryable: true,
            details: error.response?.data
          });
        }

        throw translateAxiosError('Uber Direct', error);
      }
    }, {
      retries: this.maxRetries,
      baseDelayMs: this.retryDelayMs,
      shouldRetry: (error) => error instanceof AdapterHttpError && error.retryable,
      onRetry: (error, attempt) => logger.warn({ error, attempt }, 'retrying Uber Direct create request')
    });
  }

  async cancel(externalJobId: string): Promise<void> {
    logger.info({ externalJobId }, 'cancel Uber Direct job');
    await executeWithRetries(async () => {
      const token = await this.getAccessToken();
      try {
        await this.apiClient.post(
          `/deliveries/${encodeURIComponent(externalJobId)}/cancel`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          this.accessToken = undefined;
          throw new AdapterHttpError('Uber Direct', 'Authentication failed', {
            status: error.response?.status,
            code: error.code,
            retryable: true,
            details: error.response?.data
          });
        }

        throw translateAxiosError('Uber Direct', error);
      }
    }, {
      retries: this.maxRetries,
      baseDelayMs: this.retryDelayMs,
      shouldRetry: (error) => error instanceof AdapterHttpError && error.retryable,
      onRetry: (error, attempt) => logger.warn({ error, attempt }, 'retrying Uber Direct cancel request')
    });
  }

  async parseWebhook(req: Request): Promise<DeliveryUpdate> {
    const payload = (req.body ?? {}) as Record<string, any>;
    const body = getRawBody(req) ?? JSON.stringify(payload);
    const signature = getHeader(req, 'x-uber-signature');

    if (!signature) {
      throw new Error('Missing x-uber-signature header');
    }

    assertValidHmacSignature({
      payload: body,
      secret: this.webhookSecret,
      signature
    });

    const data = payload.data ?? payload;
    const externalJobId = String(data.delivery_id ?? data.id ?? '');

    if (!externalJobId) {
      throw new Error('Uber Direct webhook missing delivery identifier');
    }

    const update: DeliveryUpdate = {
      provider: 'uber-direct',
      externalJobId,
      status: String(payload.event ?? payload.event_type ?? data.status ?? 'unknown'),
      timestamps: normalizeTimestamps(data.timestamps),
      proof: data.proof
        ? {
            url: String(data.proof.url),
            type: String(data.proof.type ?? 'photo')
          }
        : undefined,
      rawPayload: payload
    };

    await this.publish(update);

    return update;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
      return this.accessToken.token;
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        scope: this.scope,
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret
      });

      const { data } = await this.authClient.post('/oauth/v2/token', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const token = String(data?.access_token ?? '');
      const expiresIn = Number(data?.expires_in ?? 3600);

      if (!token) {
        throw new Error('Uber Direct auth response missing access token');
      }

      this.accessToken = {
        token,
        expiresAt: Date.now() + expiresIn * 1000
      };

      return token;
    } catch (error) {
      throw translateAxiosError('Uber Direct Auth', error);
    }
  }
}
