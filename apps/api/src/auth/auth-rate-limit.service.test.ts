import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AuthRateLimitService } from './auth-rate-limit.service.js';

describe('AuthRateLimitService', () => {
  it('rate limits repeated failures with local fallback when Redis is disabled', async () => {
    process.env.AUTH_RATE_LIMIT_REDIS_DISABLED = 'true';

    const service = new AuthRateLimitService();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await service.assertLoginAllowed('reader@example.com', '127.0.0.1');
      await service.recordFailedLogin('reader@example.com', '127.0.0.1');
    }

    try {
      await service.assertLoginAllowed('reader@example.com', '127.0.0.1');
      throw new Error('Expected login to be rate limited.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }

    await service.clearLoginFailures('reader@example.com', '127.0.0.1');
    await expect(
      service.assertLoginAllowed('reader@example.com', '127.0.0.1')
    ).resolves.toBeUndefined();
  });
});
