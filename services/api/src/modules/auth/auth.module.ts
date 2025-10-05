import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [ConfigModule],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService]
})
export class AuthModule {}
