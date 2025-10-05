import axios, { type AxiosAdapter, type AxiosInstance } from 'axios';
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

const logger = pino({ name: 'olo-adapter' });

interface OloAdapterOptions {
  apiKey: string;
  baseUrl: string;
  webhookSecret: string;
  publisher?: DeliveryUpdatePublisher;
  maxRetries?: number;
  retryDelayMs?: number;
  httpAdapter?: AxiosAdapter;
}

export class OloAdapter implements CourierAdapter {
  private readonly client: AxiosInstance;
  private readonly webhookSecret: string;
  private readonly publish: DeliveryUpdatePublisher;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: OloAdapterOptions) {
    this.client = axios.create({
      baseURL: options.baseUrl,
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json'
      },
      adapter: options.httpAdapter
    });
    this.webhookSecret = options.webhookSecret;
    this.publish = options.publisher ?? publishDeliveryUpdate;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 100;
  }

  async quote(req: QuoteRequest): Promise<QuoteResponse> {
    logger.info({ req }, 'requesting Olo quote');

    return executeWithRetries(async () => {
      try {
        const { data } = await this.client.post('/deliveries/quotes', {
          pickup: { address: req.pickupAddress },
          dropoff: { address: req.dropoffAddress },
          ready_at: req.readyAt,
          reference: req.reference
        });

        const fee = Number(data?.price?.amount ?? data?.fee ?? 0);
        const currency = String(data?.price?.currency ?? data?.currency ?? 'USD');
        const etaMinutes = Number(data?.eta?.minutes ?? data?.etaMinutes ?? 0);

        return { fee, currency, etaMinutes } satisfies QuoteResponse;
      } catch (error) {
        throw translateAxiosError('Olo', error);
      }
    }, {
      retries: this.maxRetries,
      baseDelayMs: this.retryDelayMs,
      shouldRetry: (error) => error instanceof AdapterHttpError && error.retryable,
      onRetry: (error, attempt) => logger.warn({ error, attempt }, 'retrying Olo quote request')
    });
  }

  async create(job: CreateJobRequest): Promise<CreateJobResponse> {
    logger.info({ job }, 'creating Olo delivery');

    return executeWithRetries(async () => {
      try {
        const { data } = await this.client.post('/deliveries', {
          pickup: { address: job.pickupAddress },
          dropoff: { address: job.dropoffAddress },
          ready_at: job.readyAt,
          reference: job.reference,
          contact: {
            email: job.contactEmail,
            phone: job.contactPhone
          }
        });

        return {
          externalJobId: String(data?.order_id ?? data?.id ?? ''),
          trackingUrl: data?.tracking_url ?? data?.trackingUrl
        } satisfies CreateJobResponse;
      } catch (error) {
        throw translateAxiosError('Olo', error);
      }
    }, {
      retries: this.maxRetries,
      baseDelayMs: this.retryDelayMs,
      shouldRetry: (error) => error instanceof AdapterHttpError && error.retryable,
      onRetry: (error, attempt) => logger.warn({ error, attempt }, 'retrying Olo create request')
    });
  }

  async cancel(externalJobId: string): Promise<void> {
    logger.info({ externalJobId }, 'cancel Olo delivery');

    await executeWithRetries(async () => {
      try {
        await this.client.post(`/deliveries/${encodeURIComponent(externalJobId)}/cancel`);
      } catch (error) {
        throw translateAxiosError('Olo', error);
      }
    }, {
      retries: this.maxRetries,
      baseDelayMs: this.retryDelayMs,
      shouldRetry: (error) => error instanceof AdapterHttpError && error.retryable,
      onRetry: (error, attempt) => logger.warn({ error, attempt }, 'retrying Olo cancel request')
    });
  }

  async parseWebhook(req: Request): Promise<DeliveryUpdate> {
    const payload = (req.body ?? {}) as Record<string, any>;
    const body = getRawBody(req) ?? JSON.stringify(payload);
    const signature = getHeader(req, 'x-olo-signature');

    if (!signature) {
      throw new Error('Missing x-olo-signature header');
    }

    assertValidHmacSignature({
      payload: body,
      secret: this.webhookSecret,
      signature
    });

    const externalJobId = String(payload.order_id ?? payload.id ?? '');

    if (!externalJobId) {
      throw new Error('Olo webhook missing order identifier');
    }

    const update: DeliveryUpdate = {
      provider: 'olo',
      externalJobId,
      status: String(payload.eventType ?? payload.status ?? 'received'),
      timestamps: normalizeTimestamps(payload.timestamps ?? payload.timeline),
      proof: payload.proof
        ? {
            url: String(payload.proof.url),
            type: String(payload.proof.type ?? 'photo')
          }
        : undefined,
      rawPayload: payload
    };

    await this.publish(update);

    return update;
  }
}
