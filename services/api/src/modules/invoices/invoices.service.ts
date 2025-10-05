import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listByOrg(orgId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { orgId },
      include: { lines: true },
      orderBy: { periodEnd: 'desc' }
    });

    return invoices.map((invoice) => ({
      ...invoice,
      subtotal: invoice.subtotal.toString(),
      deliveryTotal: invoice.deliveryTotal.toString(),
      tipsTotal: invoice.tipsTotal.toString(),
      discountsTotal: invoice.discountsTotal.toString(),
      taxesTotal: invoice.taxesTotal.toString(),
      paymentFees: invoice.paymentFees.toString(),
      total: invoice.total.toString(),
      lines: invoice.lines.map((line) => ({
        ...line,
        unitAmount: line.unitAmount.toString(),
        total: line.total.toString()
      }))
    }));
  }
}
