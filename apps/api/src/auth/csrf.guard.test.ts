import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME
} from './auth-cookie.js';
import { CsrfGuard } from './csrf.guard.js';
import type { AuthenticatedRequest } from './auth.types.js';

describe('CsrfGuard', () => {
  it('allows safe requests without csrf token', () => {
    const guard = new CsrfGuard(reflector(false));
    const request = createRequest({ method: 'GET' });

    expect(guard.canActivate(context(request))).toBe(true);
  });

  it('allows bearer-only unsafe requests without csrf token', () => {
    const guard = new CsrfGuard(reflector(false));
    const request = createRequest({
      method: 'POST',
      authorization: 'Bearer token'
    });

    expect(guard.canActivate(context(request))).toBe(true);
  });

  it('rejects unsafe cookie-auth requests without matching csrf header', () => {
    const guard = new CsrfGuard(reflector(false));
    const request = createRequest({
      method: 'POST',
      cookie: `${AUTH_COOKIE_NAME}=jwt; ${CSRF_COOKIE_NAME}=csrf-cookie`
    });

    expect(() => guard.canActivate(context(request))).toThrow(ForbiddenException);
  });

  it('allows unsafe cookie-auth requests with matching csrf header', () => {
    const guard = new CsrfGuard(reflector(false));
    const request = createRequest({
      method: 'PATCH',
      cookie: `${AUTH_COOKIE_NAME}=jwt; ${CSRF_COOKIE_NAME}=csrf-cookie`,
      csrf: 'csrf-cookie'
    });

    expect(guard.canActivate(context(request))).toBe(true);
  });
});

function reflector(isPublic: boolean): Reflector {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic)
  } as unknown as Reflector;
}

function createRequest(input: {
  readonly method: string;
  readonly authorization?: string;
  readonly cookie?: string;
  readonly csrf?: string;
}): AuthenticatedRequest {
  return {
    method: input.method,
    header: (name: string) => {
      const normalized = name.toLowerCase();

      if (normalized === 'authorization') {
        return input.authorization;
      }

      if (normalized === 'cookie') {
        return input.cookie;
      }

      if (normalized === CSRF_HEADER_NAME) {
        return input.csrf;
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
