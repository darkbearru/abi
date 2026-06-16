import { afterEach, describe, expect, it } from 'vitest';

import { getCorsConfig } from './cors.config.js';

const ORIGINAL_ENV = { ...process.env };

describe('getCorsConfig', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('uses configured origin allowlist', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com, https://admin.example.com ';
    process.env.NODE_ENV = 'production';

    expect(getCorsConfig().origins).toEqual([
      'https://app.example.com',
      'https://admin.example.com'
    ]);
  });

  it('fails fast in production without origins', () => {
    delete process.env.CORS_ORIGINS;
    process.env.NODE_ENV = 'production';

    expect(() => getCorsConfig()).toThrow('CORS_ORIGINS must be set in production.');
  });
});
