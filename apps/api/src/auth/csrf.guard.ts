import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  parseCookie
} from './auth-cookie.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { IS_PUBLIC_ROUTE_KEY } from './public.decorator.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const cookieHeader = request.header('cookie');
    const authCookie = parseCookie(cookieHeader, AUTH_COOKIE_NAME);

    if (!authCookie) {
      return true;
    }

    const csrfCookie = parseCookie(cookieHeader, CSRF_COOKIE_NAME);
    const csrfHeader = request.header(CSRF_HEADER_NAME);

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException('CSRF token is invalid or missing.');
    }

    return true;
  }
}
