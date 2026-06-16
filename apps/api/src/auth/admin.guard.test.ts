import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';

import { AdminGuard } from './admin.guard.js';
import type { AuthenticatedRequest } from './auth.types.js';

const ORIGINAL_ADMIN_USER_IDS = process.env.ADMIN_USER_IDS;

describe('AdminGuard', () => {
  afterEach(() => {
    process.env.ADMIN_USER_IDS = ORIGINAL_ADMIN_USER_IDS;
  });

  it('allows database admins', () => {
    const guard = new AdminGuard();

    expect(guard.canActivate(createContext({ id: 'user-1', role: 'ADMIN' }))).toBe(true);
  });

  it('allows bootstrap admins from env', () => {
    process.env.ADMIN_USER_IDS = 'user-2';
    const guard = new AdminGuard();

    expect(guard.canActivate(createContext({ id: 'user-2', role: 'USER' }))).toBe(true);
  });

  it('rejects non-admin users', () => {
    const guard = new AdminGuard();

    expect(() => guard.canActivate(createContext({ id: 'user-3', role: 'USER' }))).toThrow(
      ForbiddenException
    );
  });
});

function createContext(user: { readonly id: string; readonly role: 'USER' | 'ADMIN' }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () =>
        ({
          user: {
            id: user.id,
            email: `${user.id}@example.com`,
            name: null,
            role: user.role
          }
        }) as AuthenticatedRequest
    })
  } as ExecutionContext;
}
