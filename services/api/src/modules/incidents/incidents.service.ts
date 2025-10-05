import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateIncidentDto) {
    return this.prisma.incident.create({
      data: {
        orgId: dto.orgId,
        orderId: dto.orderId,
        batchId: dto.batchId,
        deliveryJobId: dto.deliveryJobId,
        reporterId: dto.reporterId,
        category: dto.category,
        severity: dto.severity,
        description: dto.description,
        attachments: dto.attachments ?? undefined,
        resolution: dto.resolution ?? undefined
      }
    });
  }
}
