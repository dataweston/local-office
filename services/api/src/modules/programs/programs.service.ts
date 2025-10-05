import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(dto: CreateProgramDto) {
    const baseData = {
      orgId: dto.orgId,
      siteId: dto.siteId,
      name: dto.name,
      cadence: dto.cadence,
      orderingWindow: dto.orderingWindow,
      cutoffHours: dto.cutoffHours ?? 48,
      loyaltyRequired: dto.loyaltyRequired ?? false,
      subsidyRules: dto.subsidyRules ?? undefined
    };

    return this.prisma.$transaction(async (tx) => {
      const program = dto.id
        ? await tx.program.update({
            where: { id: dto.id },
            data: baseData
          })
        : await tx.program.create({
            data: baseData
          });

      if (!program) {
        throw new NotFoundException('Program not found');
      }

      await tx.programSlot.deleteMany({ where: { programId: program.id } });

      await tx.programSlot.createMany({
        data: dto.slots.map((slot) => ({
          ...(slot.id ? { id: slot.id } : {}),
          programId: program.id,
          providerId: slot.providerId,
          serviceDate: new Date(slot.serviceDate),
          windowStart: new Date(slot.windowStart),
          windowEnd: new Date(slot.windowEnd),
          cutoffAt: new Date(slot.cutoffAt)
        }))
      });

      return tx.program.findUnique({
        where: { id: program.id },
        include: { programSlots: true }
      });
    });
  }
}
