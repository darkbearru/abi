import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { JwtTokenService } from './jwt-token.service.js';
import { IS_PUBLIC_ROUTE_KEY } from './public.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: JwtTokenService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = getBearerToken(request.header('authorization'));
    const payload = this.tokens.verify(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    if (user === null) {
      throw new UnauthorizedException('User no longer exists.');
    }

    Object.assign(request, { user });

    return true;
  }
}

function getBearerToken(authorizationHeader: string | undefined): string {
  const bearerPrefix = 'Bearer ';

  if (
    authorizationHeader === undefined ||
    !authorizationHeader.startsWith(bearerPrefix) ||
    authorizationHeader.slice(bearerPrefix.length).trim().length === 0
  ) {
    throw new UnauthorizedException('Bearer authentication token is required.');
  }

  return authorizationHeader.slice(bearerPrefix.length).trim();
}
