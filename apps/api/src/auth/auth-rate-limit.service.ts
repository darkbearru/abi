import { createHash } from 'node:crypto';

import { HttpException, HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

const LOGIN_FAILURE_LIMIT = Number.parseInt(process.env.AUTH_LOGIN_FAILURE_LIMIT ?? '5', 10);
const LOGIN_FAILURE_WINDOW_MS = Number.parseInt(
  process.env.AUTH_LOGIN_FAILURE_WINDOW_MS ?? String(15 * 60 * 1000),
  10
);

@Injectable()
export class AuthRateLimitService implements OnModuleDestroy {
  private readonly fallback = new Map<string, LoginFailureState>();
  private readonly redis: Redis | undefined =
    process.env.REDIS_URL && process.env.AUTH_RATE_LIMIT_REDIS_DISABLED !== 'true'
      ? new Redis(process.env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false
        })
      : undefined;

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
  }

  async assertLoginAllowed(email: string, clientIp: string | undefined): Promise<void> {
    const key = this.createKey(email, clientIp);
    const count = await this.getFailureCount(key);

    if (count >= getLoginFailureLimit()) {
      throw new HttpException(
        'Too many failed login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  async recordFailedLogin(email: string, clientIp: string | undefined): Promise<void> {
    const key = this.createKey(email, clientIp);

    if (this.redis) {
      try {
        await this.ensureRedisConnected();
        const count = await this.redis.incr(key);

        if (count === 1) {
          await this.redis.pexpire(key, getLoginFailureWindowMs());
        }
        return;
      } catch {
        // Fallback keeps local development and unit tests independent from Redis availability.
      }
    }

    const state = this.getActiveFallbackState(key);

    this.fallback.set(key, {
      firstFailureAt: state?.firstFailureAt ?? Date.now(),
      count: (state?.count ?? 0) + 1
    });
  }

  async clearLoginFailures(email: string, clientIp: string | undefined): Promise<void> {
    const key = this.createKey(email, clientIp);
    this.fallback.delete(key);

    if (!this.redis) {
      return;
    }

    try {
      await this.ensureRedisConnected();
      await this.redis.del(key);
    } catch {
      // Clearing the local fallback is enough when Redis is temporarily unavailable.
    }
  }

  private async getFailureCount(key: string): Promise<number> {
    if (this.redis) {
      try {
        await this.ensureRedisConnected();
        const value = await this.redis.get(key);

        return value ? Number.parseInt(value, 10) || 0 : 0;
      } catch {
        // Fallback below.
      }
    }

    return this.getActiveFallbackState(key)?.count ?? 0;
  }

  private getActiveFallbackState(key: string): LoginFailureState | undefined {
    const state = this.fallback.get(key);

    if (state === undefined) {
      return undefined;
    }

    if (Date.now() - state.firstFailureAt > getLoginFailureWindowMs()) {
      this.fallback.delete(key);
      return undefined;
    }

    return state;
  }

  private async ensureRedisConnected(): Promise<void> {
    if (this.redis && this.redis.status === 'wait') {
      await this.redis.connect();
    }
  }

  private createKey(email: string, clientIp: string | undefined): string {
    const digest = createHash('sha256')
      .update(`${email}:${clientIp ?? 'unknown'}`)
      .digest('hex');

    return `abi:auth:login-fail:${digest}`;
  }
}

interface LoginFailureState {
  readonly firstFailureAt: number;
  readonly count: number;
}

function getLoginFailureLimit(): number {
  return Number.isFinite(LOGIN_FAILURE_LIMIT) && LOGIN_FAILURE_LIMIT > 0 ? LOGIN_FAILURE_LIMIT : 5;
}

function getLoginFailureWindowMs(): number {
  return Number.isFinite(LOGIN_FAILURE_WINDOW_MS) && LOGIN_FAILURE_WINDOW_MS > 0
    ? LOGIN_FAILURE_WINDOW_MS
    : 15 * 60 * 1000;
}
