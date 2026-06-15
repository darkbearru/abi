import { AiTimeoutError } from './errors.js';

export const DEFAULT_AI_TIMEOUT_MS = 60_000;

export interface AbortableOperationContext {
  readonly signal: AbortSignal;
}

export function executeWithTimeout<T>(
  operation: (context: AbortableOperationContext) => Promise<T>,
  timeoutMs: number = DEFAULT_AI_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      controller.abort();
      reject(new AiTimeoutError(timeoutMs));
    }, timeoutMs);

    operation({ signal: controller.signal })
      .then(resolve)
      .catch(reject)
      .finally(() => {
        clearTimeout(timeout);
      });
  });
}
