import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import { BatchStatus, InvoicePeriod, Prisma } from '@local-office/db';

import { createInvoiceJob, type InvoiceJobData } from '../src/jobs/invoice';

describe('invoice job', () => {
  function createPrismaStub() {
    const start = new Date('2024-09-02T00:00:00.000Z');
    const end = new Date('2024-09-08T23:59:59.999Z');

    const state = {
      invoiceSequence: 0,
      invoices: [] as any[],
      invoiceLines: [] as any[],
      batches: [
        {
          id: 'batch-1',
          orgId: 'org-1',
          status: BatchStatus.LOCKED,
          deliveryFee: new Prisma.Decimal(20),
          gratuity: new Prisma.Decimal(10),
          programSlot: { serviceDate: new Date('2024-09-04T12:00:00.000Z') },
          orders: [
            { id: 'order-1', total: new Prisma.Decimal(150) }
          ]
        }
      ],
      billingConfig: {
        orgId: 'org-1',
        squareCustomerId: 'cust-1',
        squareLocationId: 'loc-1',
        currency: 'USD',
        netTermsDays: 7,
        org: { id: 'org-1', name: 'Org One' }
      },
      range: { start, end }
    };

    const prisma = {
      batch: {
        findMany: vi.fn(async () => state.batches)
      },
      invoice: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => {
          const id = `inv-${++state.invoiceSequence}`;
          const invoice = {
            ...data,
            id,
            externalId: null as string | null,
            status: data.status ?? 'draft',
            externalUrl: null as string | null,
            rawResponse: null as unknown,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          state.invoices.push(invoice);
          return { ...invoice };
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const invoice = state.invoices.find((entry) => entry.id === where.id);
          if (!invoice) {
            throw new Error('Invoice not found');
          }
          Object.assign(invoice, data, { updatedAt: new Date() });
          return { ...invoice };
        })
      },
      invoiceLine: {
        deleteMany: vi.fn(async ({ where }: any) => {
          state.invoiceLines = state.invoiceLines.filter((line) => line.invoiceId !== where.invoiceId);
        }),
        create: vi.fn(async ({ data }: any) => {
          state.invoiceLines.push({ ...data });
          return { ...data };
        })
      },
      orgBillingConfig: {
        findUnique: vi.fn(async ({ where }: any) => {
          return where.orgId === state.billingConfig.orgId ? { ...state.billingConfig } : null;
        })
      },
      $transaction: async (fn: any) => {
        const snapshot = {
          invoiceSequence: state.invoiceSequence,
          invoices: state.invoices.map((invoice) => ({ ...invoice })),
          invoiceLines: state.invoiceLines.map((line) => ({ ...line }))
        };
        try {
          return await fn(prisma);
        } catch (error) {
          state.invoiceSequence = snapshot.invoiceSequence;
          state.invoices = snapshot.invoices;
          state.invoiceLines = snapshot.invoiceLines;
          throw error;
        }
      }
    } as any;

    return { prisma, state };
  }

  it('calls billing service and stores Square metadata', async () => {
    const { prisma, state } = createPrismaStub();

    const billing = {
      createInvoice: vi.fn(async () => ({
        id: 'sq-invoice-1',
        status: 'DRAFT',
        totalAmount: 180,
        publicUrl: 'https://square.test/invoices/sq-invoice-1',
        rawResponse: { id: 'sq-invoice-1', status: 'DRAFT' }
      }))
    } as any;

    const handler = createInvoiceJob(prisma, billing);

    const job: Job<InvoiceJobData> = {
      name: 'closeout',
      id: 'job-1',
      data: {
        orgId: 'org-1',
        period: InvoicePeriod.WEEK,
        periodStart: state.range.start.toISOString(),
        periodEnd: state.range.end.toISOString()
      }
    } as Job<InvoiceJobData>;

    const result = await handler(job);

    expect(result).toEqual([
      {
        orgId: 'org-1',
        invoiceId: 'inv-1',
        batchCount: 1,
        total: '180'
      }
    ]);

    expect(billing.createInvoice).toHaveBeenCalledTimes(1);
    expect(billing.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        customerId: 'cust-1',
        locationId: 'loc-1',
        dueDate: '2024-09-15',
        idempotencyKey: 'invoice_inv-1',
        period: InvoicePeriod.WEEK,
        lineItems: [
          {
            name: 'Batch batch-1',
            quantity: 1,
            amount: 180
          }
        ]
      })
    );

    const stored = state.invoices.find((invoice) => invoice.id === 'inv-1');
    expect(stored).toMatchObject({
      externalId: 'sq-invoice-1',
      status: 'DRAFT',
      externalUrl: 'https://square.test/invoices/sq-invoice-1',
      rawResponse: { id: 'sq-invoice-1', status: 'DRAFT' }
    });
  });

  it('bubbles up billing failures', async () => {
    const { prisma, state } = createPrismaStub();

    const billingError = new Error('Square unavailable');
    const billing = {
      createInvoice: vi.fn(async () => {
        throw billingError;
      })
    } as any;

    const handler = createInvoiceJob(prisma, billing);

    const job: Job<InvoiceJobData> = {
      name: 'closeout',
      id: 'job-2',
      data: {
        orgId: 'org-1',
        period: InvoicePeriod.WEEK,
        periodStart: state.range.start.toISOString(),
        periodEnd: state.range.end.toISOString()
      }
    } as Job<InvoiceJobData>;

    await expect(handler(job)).rejects.toThrow(billingError);
    expect(billing.createInvoice).toHaveBeenCalledTimes(1);
  });
});
