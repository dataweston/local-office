import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgramsModule } from './programs/programs.module';
import { OrdersModule } from './orders/orders.module';
import { BatchesModule } from './batches/batches.module';
import { IncidentsModule } from './incidents/incidents.module';
import { ReferralsModule } from './referrals/referrals.module';
import { InvoicesModule } from './invoices/invoices.module';
import { DeliveriesModule } from './deliveries/deliveries.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    ProgramsModule,
    OrdersModule,
    BatchesModule,
    IncidentsModule,
    ReferralsModule,
    InvoicesModule,
    DeliveriesModule
  ]
})
export class AppModule {}
