import axios from 'axios';
import httpAdapter from 'axios/lib/adapters/http.js';
import type { Request } from 'express';
import nock from 'nock';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DispatchAdapter } from '../dispatch';
import { OloAdapter } from '../olo';
import { UberDirectAdapter } from '../uberDirect';
import { AdapterHttpError } from '../../utils/errors';
import { createHmacDigest } from '../../utils/signature';

axios.defaults.adapter = httpAdapter;
process.env.HTTP_PROXY = '';
process.env.http_proxy = '';
process.env.HTTPS_PROXY = '';
process.env.https_proxy = '';
process.env.NO_PROXY = '*';
process.env.no_proxy = '*';

describe('Courier adapters', () => {
  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    vi.clearAllMocks();
  });

  describe('DispatchAdapter', () => {
    const publisher = vi.fn().mockResolvedValue(undefined);
    let adapter: DispatchAdapter;

    beforeEach(() => {
      publisher.mockClear();
      adapter = new DispatchAdapter({
        apiKey: 'dispatch-key',
        baseUrl: 'https://dispatch.example.com/',
        webhookSecret: 'dispatch-secret',
        publisher,
        maxRetries: 1,
        retryDelayMs: 0,
        httpAdapter
      });
    });

    it('requests quotes with retries and normalizes response', async () => {
      nock('https://dispatch.example.com')
        .post('/delivery/quotes')
        .reply(500, { message: 'temporary error' })
        .post('/delivery/quotes', (body) => {
          expect(body.reference).toBe('order-123');
          return true;
        })
        .reply(200, { price: { amount: 19.75, currency: 'USD' }, eta: { minutes: 42 } });

      const result = await adapter.quote({
        pickupAddress: '123 Start St',
        dropoffAddress: '789 End Ave',
        readyAt: '2024-01-01T10:00:00Z',
        reference: 'order-123'
      });

      expect(result).toEqual({ fee: 19.75, currency: 'USD', etaMinutes: 42 });
    });

    it('translates HTTP errors', async () => {
      nock('https://dispatch.example.com')
        .post('/delivery/quotes')
        .reply(400, { message: 'invalid address' });

      await expect(
        adapter.quote({
          pickupAddress: 'bad',
          dropoffAddress: 'dest',
          readyAt: '2024-01-01T10:00:00Z',
          reference: 'bad-order'
        })
      ).rejects.toBeInstanceOf(AdapterHttpError);
    });

    it('verifies webhook signatures and publishes delivery updates', async () => {
      const payload = {
        job_id: 'dispatch-1',
        status: 'delivered',
        timestamps: {
          dispatched_at: '2024-01-01T10:00:00Z',
          delivered_at: '2024-01-01T10:45:00Z'
        },
        proof: { url: 'https://dispatch.test/proof.jpg', type: 'photo' }
      };
      const rawBody = JSON.stringify(payload);
      const signature = createHmacDigest({ payload: rawBody, secret: 'dispatch-secret' });

      const req = buildRequest(payload, {
        'x-dispatch-signature': signature
      });
      (req as any).rawBody = rawBody;

      const update = await adapter.parseWebhook(req);

      expect(update).toMatchObject({
        provider: 'dispatch',
        externalJobId: 'dispatch-1',
        status: 'delivered'
      });
      expect(publisher).toHaveBeenCalledWith(expect.objectContaining({ externalJobId: 'dispatch-1' }));
    });

    it('rejects invalid webhook signatures', async () => {
      const payload = { job_id: 'dispatch-1', status: 'delivered' };
      const req = buildRequest(payload, {
        'x-dispatch-signature': 'deadbeef'
      });
      (req as any).rawBody = JSON.stringify(payload);

      await expect(adapter.parseWebhook(req)).rejects.toThrow('Invalid webhook signature');
    });
  });

  describe('UberDirectAdapter', () => {
    const publisher = vi.fn().mockResolvedValue(undefined);
    let adapter: UberDirectAdapter;

    beforeEach(() => {
      publisher.mockClear();
      adapter = new UberDirectAdapter({
        clientId: 'uber-client',
        clientSecret: 'uber-secret',
        webhookSecret: 'uber-webhook',
        baseUrl: 'https://uber.example.com/',
        authUrl: 'https://login.uber.example.com/',
        publisher,
        maxRetries: 2,
        retryDelayMs: 0,
        httpAdapter
      });
    });

    it('requests quotes after fetching an access token', async () => {
      nock('https://login.uber.example.com')
        .post('/oauth/v2/token')
        .reply(200, { access_token: 'token-1', expires_in: 3600 });

      nock('https://uber.example.com')
        .post('/quotes')
        .matchHeader('Authorization', 'Bearer token-1')
        .reply(200, { price: { amount: 25.5, currency: 'USD' }, eta: { minutes: 30 } });

      const result = await adapter.quote({
        pickupAddress: 'Warehouse',
        dropoffAddress: 'Customer',
        readyAt: '2024-01-01T11:00:00Z',
        reference: 'uber-order'
      });

      expect(result).toEqual({ fee: 25.5, currency: 'USD', etaMinutes: 30 });
    });

    it('refreshes the token when receiving a 401 response', async () => {
      nock('https://login.uber.example.com')
        .post('/oauth/v2/token')
        .reply(200, { access_token: 'token-expired', expires_in: 3600 })
        .post('/oauth/v2/token')
        .reply(200, { access_token: 'token-fresh', expires_in: 3600 });

      nock('https://uber.example.com')
        .post('/deliveries')
        .matchHeader('Authorization', 'Bearer token-expired')
        .reply(401, { message: 'expired' })
        .post('/deliveries')
        .matchHeader('Authorization', 'Bearer token-fresh')
        .reply(200, { delivery_id: 'uber-1', tracking_url: 'https://uber.test/track/uber-1' });

      const result = await adapter.create({
        pickupAddress: 'Warehouse',
        dropoffAddress: 'Customer',
        readyAt: '2024-01-01T11:00:00Z',
        reference: 'uber-order',
        contactEmail: 'ops@example.com',
        contactPhone: '+123456789'
      });

      expect(result.externalJobId).toBe('uber-1');
    });

    it('verifies webhook payloads', async () => {
      const payload = {
        event: 'delivery.updated',
        data: {
          delivery_id: 'uber-99',
          status: 'en_route',
          timestamps: {
            en_route_at: '2024-01-01T12:00:00Z'
          }
        }
      };
      const rawBody = JSON.stringify(payload);
      const signature = createHmacDigest({ payload: rawBody, secret: 'uber-webhook' });

      const req = buildRequest(payload, { 'x-uber-signature': signature });
      (req as any).rawBody = rawBody;

      const update = await adapter.parseWebhook(req);

      expect(update).toMatchObject({ provider: 'uber-direct', externalJobId: 'uber-99', status: 'delivery.updated' });
      expect(publisher).toHaveBeenCalledWith(expect.objectContaining({ externalJobId: 'uber-99' }));
    });

    it('rejects invalid Uber Direct signatures', async () => {
      const payload = { delivery_id: 'uber-1' };
      const req = buildRequest(payload, { 'x-uber-signature': 'bad' });
      (req as any).rawBody = JSON.stringify(payload);

      await expect(adapter.parseWebhook(req)).rejects.toThrow('Invalid webhook signature');
    });
  });

  describe('OloAdapter', () => {
    const publisher = vi.fn().mockResolvedValue(undefined);
    let adapter: OloAdapter;

    beforeEach(() => {
      publisher.mockClear();
      adapter = new OloAdapter({
        apiKey: 'olo-key',
        baseUrl: 'https://olo.example.com/',
        webhookSecret: 'olo-secret',
        publisher,
        maxRetries: 1,
        retryDelayMs: 0,
        httpAdapter
      });
    });

    it('creates deliveries via HTTP', async () => {
      nock('https://olo.example.com')
        .post('/deliveries')
        .reply(200, { order_id: 'olo-123', tracking_url: 'https://olo.test/track/olo-123' });

      const result = await adapter.create({
        pickupAddress: 'Location A',
        dropoffAddress: 'Location B',
        readyAt: '2024-01-01T12:30:00Z',
        reference: 'olo-order'
      });

      expect(result).toEqual({ externalJobId: 'olo-123', trackingUrl: 'https://olo.test/track/olo-123' });
    });

    it('verifies webhook signatures', async () => {
      const payload = {
        order_id: 'olo-77',
        eventType: 'completed',
        timestamps: {
          completed_at: '2024-01-01T13:00:00Z'
        }
      };
      const rawBody = JSON.stringify(payload);
      const signature = createHmacDigest({ payload: rawBody, secret: 'olo-secret' });

      const req = buildRequest(payload, { 'x-olo-signature': signature });
      (req as any).rawBody = rawBody;

      const update = await adapter.parseWebhook(req);

      expect(update).toMatchObject({ provider: 'olo', externalJobId: 'olo-77', status: 'completed' });
      expect(publisher).toHaveBeenCalledWith(expect.objectContaining({ externalJobId: 'olo-77' }));
    });

    it('rejects invalid Olo signatures', async () => {
      const payload = { order_id: 'olo-1' };
      const req = buildRequest(payload, { 'x-olo-signature': 'bad' });
      (req as any).rawBody = JSON.stringify(payload);

      await expect(adapter.parseWebhook(req)).rejects.toThrow('Invalid webhook signature');
    });
  });
});

function buildRequest(payload: any, headers: Record<string, string>): Request {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    body: payload,
    headers: normalizedHeaders as any,
    get(name: string) {
      return normalizedHeaders[name.toLowerCase()];
    }
  } as unknown as Request;
}
