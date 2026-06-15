import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JwtTokenService } from './jwt-token.service.js';

describe('JwtTokenService', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN_SECONDS = '60';
    vi.useRealTimers();
  });

  it('signs and verifies HS256 tokens', () => {
    const service = new JwtTokenService();
    const token = service.sign({
      id: 'user-1',
      email: 'reader@example.com',
      name: 'Reader'
    });

    expect(service.verify(token)).toMatchObject({
      sub: 'user-1',
      email: 'reader@example.com',
      name: 'Reader'
    });
  });

  it('rejects expired tokens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));

    const service = new JwtTokenService();
    const token = service.sign({
      id: 'user-1',
      email: 'reader@example.com',
      name: null
    });

    vi.setSystemTime(new Date('2026-06-15T00:02:00.000Z'));

    expect(() => {
      service.verify(token);
    }).toThrow('expired');
  });
});
