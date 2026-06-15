import { AiProviderRequestError, AiTimeoutError } from './errors.js';
import type { AiRetryPolicy } from './types.js';

export const DEFAULT_AI_RETRY_POLICY: AiRetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 250,
  maxDelayMs: 2_000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 409, 425, 429, 500, 502, 503, 504]
};

export type SleepFunction = (delayMs: number) => Promise<void>;

export interface ExecuteWithRetryOptions {
  readonly retryPolicy?: AiRetryPolicy | undefined;
  readonly sleep?: SleepFunction;
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: ExecuteWithRetryOptions = {}
): Promise<T> {
  const policy = normalizeRetryPolicy(options.retryPolicy ?? DEFAULT_AI_RETRY_POLICY);
  const sleep = options.sleep ?? defaultSleep;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < policy.maxAttempts) {
    attempt += 1;

    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= policy.maxAttempts || !isRetryableError(error, policy)) {
        throw error;
      }

      await sleep(getRetryDelayMs(policy, attempt));
    }
  }

  throw lastError;
}

export function isRetryableError(error: unknown, policy: AiRetryPolicy): boolean {
  if (error instanceof AiTimeoutError) {
    return false;
  }

  if (error instanceof AiProviderRequestError) {
    if (error.statusCode === undefined) {
      return true;
    }

    return (policy.retryableStatusCodes ?? []).includes(error.statusCode);
  }

  return error instanceof TypeError;
}

function normalizeRetryPolicy(policy: AiRetryPolicy): Required<AiRetryPolicy> {
  return {
    maxAttempts: Math.max(1, Math.floor(policy.maxAttempts)),
    initialDelayMs: Math.max(0, Math.floor(policy.initialDelayMs)),
    maxDelayMs: Math.max(
      0,
      Math.floor(policy.maxDelayMs ?? DEFAULT_AI_RETRY_POLICY.maxDelayMs ?? policy.initialDelayMs)
    ),
    backoffMultiplier: Math.max(1, policy.backoffMultiplier ?? 1),
    retryableStatusCodes:
      policy.retryableStatusCodes ?? DEFAULT_AI_RETRY_POLICY.retryableStatusCodes ?? []
  };
}

function getRetryDelayMs(policy: Required<AiRetryPolicy>, failedAttempt: number): number {
  const exponentialDelay =
    policy.initialDelayMs * policy.backoffMultiplier ** Math.max(0, failedAttempt - 1);

  return Math.min(policy.maxDelayMs, Math.floor(exponentialDelay));
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
