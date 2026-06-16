import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthRateLimitService } from './auth-rate-limit.service.js';
import { AuthService } from './auth.service.js';
import { JwtTokenService } from './jwt-token.service.js';
import { PasswordService } from './password.service.js';

describe('AuthService', () => {
  it('registers users with a hashed password and returns a token', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'reader@example.com',
      name: 'Reader',
      role: 'USER'
    });
    const prisma = {
      user: { create }
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      new PasswordService(),
      new JwtTokenService(),
      createRateLimitMock()
    );

    const response = await service.register({
      email: 'Reader@Example.com',
      password: 'super-secret',
      name: 'Reader'
    });

    expect(response.accessToken).toBeTruthy();
    expect(response.user.email).toBe('reader@example.com');

    const createPayload = create.mock.calls[0]?.[0] as
      | { readonly data?: { readonly email?: string; readonly passwordHash?: string } }
      | undefined;

    expect(createPayload?.data?.email).toBe('reader@example.com');
    expect(createPayload?.data?.passwordHash).toMatch(/^scrypt\$/);
    expect(createPayload?.data?.passwordHash).not.toBe('super-secret');
  });

  it('rejects login when password does not match', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'reader@example.com',
          name: null,
          role: 'USER',
          passwordHash: await new PasswordService().hash('correct-password')
        })
      }
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      new PasswordService(),
      new JwtTokenService(),
      createRateLimitMock()
    );

    await expect(
      service.login({ email: 'reader@example.com', password: 'wrong-password' })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rate limits repeated failed login attempts', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'reader@example.com',
          name: null,
          role: 'USER',
          passwordHash: 'scrypt$salt$key'
        })
      }
    };
    const passwordService = {
      verify: vi.fn().mockResolvedValue(false)
    };
    const rateLimit = createRateLimitMock();
    rateLimit.assertLoginAllowed = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(
        new HttpException(
          'Too many failed login attempts. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS
        )
      );
    const service = new AuthService(
      prisma as unknown as PrismaService,
      passwordService as unknown as PasswordService,
      new JwtTokenService(),
      rateLimit
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.login({ email: 'reader@example.com', password: 'wrong-password' })
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    try {
      await service.login({ email: 'reader@example.com', password: 'wrong-password' });
      throw new Error('Expected login to be rate limited.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });
});

function createRateLimitMock(): AuthRateLimitService {
  return {
    assertLoginAllowed: vi.fn().mockResolvedValue(undefined),
    recordFailedLogin: vi.fn().mockResolvedValue(undefined),
    clearLoginFailures: vi.fn().mockResolvedValue(undefined),
    onModuleDestroy: vi.fn().mockResolvedValue(undefined)
  } as unknown as AuthRateLimitService;
}
