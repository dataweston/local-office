import type { Request } from 'express';

export interface QuoteRequest {
  pickupAddress: string;
  dropoffAddress: string;
  readyAt: string;
  reference: string;
}

export interface QuoteResponse {
  fee: number;
  currency: string;
  etaMinutes: number;
}

export interface CreateJobRequest {
  pickupAddress: string;
  dropoffAddress: string;
  readyAt: string;
  reference: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface CreateJobResponse {
  externalJobId: string;
  trackingUrl?: string;
}

export interface DeliveryUpdate {
  provider: string;
  externalJobId: string;
  status: string;
  timestamps: Record<string, string | undefined>;
  proof?: {
    url: string;
    type: string;
  };
  rawPayload: unknown;
}

export interface CourierAdapter {
  quote(req: QuoteRequest): Promise<QuoteResponse>;
  create(job: CreateJobRequest): Promise<CreateJobResponse>;
  cancel(externalJobId: string): Promise<void>;
  parseWebhook(req: Request): Promise<DeliveryUpdate>;
}

export type AdapterRegistry = Record<string, CourierAdapter>;
