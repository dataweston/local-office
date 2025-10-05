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

export interface CreateJobRequest extends QuoteRequest {
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
  proof?: { url: string; type?: string };
  rawPayload: unknown;
}

export interface CourierAdapter {
  quote(req: QuoteRequest): Promise<QuoteResponse>;
  create(job: CreateJobRequest): Promise<CreateJobResponse>;
  cancel(externalJobId: string): Promise<void>;
  parseWebhook?(req: unknown): Promise<DeliveryUpdate>;
}

export type AdapterRegistry = Record<string, CourierAdapter>;

class BaseAdapter implements CourierAdapter {
  async quote(): Promise<QuoteResponse> {
    throw new Error('Not implemented in test stub');
  }

  async create(): Promise<CreateJobResponse> {
    throw new Error('Not implemented in test stub');
  }

  async cancel(): Promise<void> {
    throw new Error('Not implemented in test stub');
  }

  async parseWebhook(): Promise<DeliveryUpdate> {
    throw new Error('Not implemented in test stub');
  }
}

export class DispatchAdapter extends BaseAdapter {}
export class UberDirectAdapter extends BaseAdapter {}
export class OloAdapter extends BaseAdapter {}
