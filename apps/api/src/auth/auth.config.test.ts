import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAuthConfig } from './auth.config.js';

describe('getAuthConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects missing JWT_SECRET in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');

    expect(() => getAuthConfig()).toThrow('JWT_SECRET is required');
  });

  it('rejects known insecure JWT_SECRET in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'change-me-use-a-long-random-secret');

    expect(() => getAuthConfig()).toThrow('strong secret');
  });
});
