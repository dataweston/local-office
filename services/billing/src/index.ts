import { randomUUID } from 'node:crypto';
import { Client, PaymentsApi, InvoicesApi } from 'square';
import pino from 'pino';

const logger = pino({ name: 'billing-service' });

function normalizeJson(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJson(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, normalizeJson(entry)])
    );
  }

  return value;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  customerId: string;
  sourceId: string;
  idempotencyKey: string;
}

export interface PaymentResponse {
  id: string;
  status: string;
  amount?: number;
  currency?: string;
  receiptUrl?: string;
  approvedAt?: string;
  completedAt?: string;
  rawResponse: unknown;
}

export interface InvoiceLineItem {
  name: string;
  quantity: number;
  amount: number;
}

export interface InvoiceRequest {
  orgId: string;
  locationId: string;
  customerId: string;
  dueDate: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  title?: string;
  description?: string;
  orderId?: string;
  idempotencyKey?: string;
  period?: 'WEEK' | 'MONTH';
}

export interface InvoiceResponse {
  id: string;
  status: string;
  totalAmount: number;
  publicUrl?: string;
  rawResponse: unknown;
}

export class BillingService {
  private readonly payments: PaymentsApi;
  private readonly invoices: InvoicesApi;

  constructor(client?: Client) {
    const squareClient =
      client ??
      new Client({
        accessToken: process.env.SQUARE_ACCESS_TOKEN,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      });
    this.payments = squareClient.paymentsApi;
    this.invoices = squareClient.invoicesApi;
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const amountMinor = Math.round(request.amount * 100);

    logger.info({ request: { ...request, amountMinor } }, 'creating Square payment');

    try {
      const { result } = await this.payments.createPayment({
        sourceId: request.sourceId,
        customerId: request.customerId,
        idempotencyKey: request.idempotencyKey,
        amountMoney: {
          amount: BigInt(amountMinor),
          currency: request.currency
        }
      });

      if (result.errors?.length) {
        const detail = result.errors.map((error) => error.detail ?? error.message).join('; ');
        throw new Error(`Square payment error: ${detail}`);
      }

      const payment = result.payment;

      if (!payment || !payment.id) {
        throw new Error('Square payment response did not include a payment object');
      }

      const amountMoney = payment.amountMoney;
      const amount = amountMoney?.amount != null ? Number(amountMoney.amount) / 100 : undefined;

      return {
        id: payment.id,
        status: payment.status ?? 'UNKNOWN',
        amount,
        currency: amountMoney?.currency,
        receiptUrl: payment.receiptUrl ?? undefined,
        approvedAt: payment.approvedAt ?? undefined,
        completedAt: payment.completedAt ?? payment.updatedAt ?? undefined,
        rawResponse: normalizeJson(payment)
      };
    } catch (error) {
      logger.error({ error, request }, 'failed to create Square payment');
      throw error;
    }
  }

  async createInvoice(request: InvoiceRequest): Promise<InvoiceResponse> {
    const totalMinor = request.lineItems.reduce((sum, item) => sum + Math.round(item.amount * 100) * item.quantity, 0);
    const idempotencyKey = request.idempotencyKey ?? randomUUID();

    logger.info({ request: { ...request, totalMinor, idempotencyKey } }, 'creating Square invoice');

    try {
      const { result } = await this.invoices.createInvoice({
        idempotencyKey,
        invoice: {
          locationId: request.locationId,
          orderId: request.orderId,
          title: request.title,
          description: request.description,
          primaryRecipient: {
            customerId: request.customerId
          },
          paymentRequests: [
            {
              requestType: 'BALANCE',
              dueDate: request.dueDate,
              fixedAmountRequestedMoney: {
                amount: BigInt(totalMinor),
                currency: request.currency
              }
            }
          ]
        }
      });

      if (result.errors?.length) {
        const detail = result.errors.map((error) => error.detail ?? error.message).join('; ');
        throw new Error(`Square invoice error: ${detail}`);
      }

      const invoice = result.invoice;

      if (!invoice || !invoice.id) {
        throw new Error('Square invoice response did not include an invoice object');
      }

      const computed = invoice.paymentRequests?.[0]?.computedAmountMoney?.amount;
      const amount = computed != null ? Number(computed) / 100 : totalMinor / 100;

      return {
        id: invoice.id,
        status: invoice.status ?? 'DRAFT',
        totalAmount: amount,
        publicUrl: invoice.publicUrl ?? undefined,
        rawResponse: normalizeJson(invoice)
      };
    } catch (error) {
      logger.error({ error, request }, 'failed to create Square invoice');
      throw error;
    }
  }
}
