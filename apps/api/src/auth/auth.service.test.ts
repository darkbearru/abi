import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { JwtTokenService } from './jwt-token.service.js';
import { PasswordService } from './password.service.js';

describe('AuthService', () => {
  it('registers users with a hashed password and returns a token', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'reader@example.com',
      name: 'Reader'
    });
    const prisma = {
      user: { create }
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      new PasswordService(),
      new JwtTokenService()
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
          passwordHash: await new PasswordService().hash('correct-password')
        })
      }
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      new PasswordService(),
      new JwtTokenService()
    );

    await expect(
      service.login({ email: 'reader@example.com', password: 'wrong-password' })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
