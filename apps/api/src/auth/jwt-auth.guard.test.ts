import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { AUTH_COOKIE_NAME } from './auth-cookie.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedRequest } from './auth.types.js';
import type { JwtTokenService } from './jwt-token.service.js';

describe('JwtAuthGuard', () => {
  it('authenticates requests with HttpOnly cookie token', async () => {
    const request = createRequest({
      cookie: `${AUTH_COOKIE_NAME}=cookie-token`
    });
    const guard = new JwtAuthGuard(
      reflector(false),
      {
        verify: vi.fn().mockReturnValue({ sub: 'user-1' })
      } as unknown as JwtTokenService,
      {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-1',
            email: 'reader@example.com',
            name: null,
            role: 'USER'
          })
        }
      } as unknown as PrismaService
    );

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.user?.id).toBe('user-1');
  });

  it('prefers bearer tokens over cookie tokens', async () => {
    const verify = vi.fn().mockReturnValue({ sub: 'user-1' });
    const guard = new JwtAuthGuard(
      reflector(false),
      { verify } as unknown as JwtTokenService,
      {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-1',
            email: 'reader@example.com',
            name: null,
            role: 'USER'
          })
        }
      } as unknown as PrismaService
    );

    await guard.canActivate(
      context(
        createRequest({
          authorization: 'Bearer bearer-token',
          cookie: `${AUTH_COOKIE_NAME}=cookie-token`
        })
      )
    );

    expect(verify).toHaveBeenCalledWith('bearer-token');
  });
});

function reflector(isPublic: boolean): Reflector {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic)
  } as unknown as Reflector;
}

function createRequest(headers: {
  readonly authorization?: string;
  readonly cookie?: string;
}): AuthenticatedRequest {
  return {
    header: (name: string) => {
      if (name === 'authorization') {
        return headers.authorization;
      }

      if (name === 'cookie') {
        return headers.cookie;
      }

      return undefined;
    }
  } as AuthenticatedRequest;
}

function context(request: AuthenticatedRequest): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}
