import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_COOKIE_NAME, parseCookie } from './auth-cookie.js';
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
    const token = getBearerToken(request.header('authorization')) ?? getCookieToken(request.header('cookie'));
    const payload = this.tokens.verify(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    if (user === null) {
      throw new UnauthorizedException('User no longer exists.');
    }

    Object.assign(request, { user });

    return true;
  }
}

function getBearerToken(authorizationHeader: string | undefined): string | undefined {
  const bearerPrefix = 'Bearer ';

  if (authorizationHeader === undefined) {
    return undefined;
  }

  if (!authorizationHeader.startsWith(bearerPrefix)) {
    throw new UnauthorizedException('Invalid authorization header.');
  }

  const token = authorizationHeader.slice(bearerPrefix.length).trim();

  return token.length > 0 ? token : undefined;
}

function getCookieToken(cookieHeader: string | undefined): string {
  const token = parseCookie(cookieHeader, AUTH_COOKIE_NAME);

  if (token === undefined || token.trim().length === 0) {
    throw new UnauthorizedException('Authentication token is required.');
  }

  return token.trim();
}
