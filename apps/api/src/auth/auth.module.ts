import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AdminGuard } from './admin.guard.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtTokenService } from './jwt-token.service.js';
import { PasswordService } from './password.service.js';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AdminGuard,
    AuthRateLimitService,
    JwtTokenService,
    PasswordService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard
    }
  ],
  exports: [AuthService, AuthRateLimitService, JwtTokenService, PasswordService, AdminGuard]
})
export class AuthModule {}
