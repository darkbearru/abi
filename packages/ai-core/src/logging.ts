import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

import type { AiRequestMetadata } from './types.js';

export type AiOperationName =
  | 'extractStructuredData'
  | 'generateText'
  | 'generateImage'
  | 'editImage';

export interface AiRequestLogPayload {
  readonly providerId: string;
  readonly operation: AiOperationName;
  readonly model?: string;
  readonly metadata?: AiRequestMetadata;
  readonly inputCharCount?: number;
  readonly inputSha256?: string;
  readonly input?: string;
}

export interface AiRequestLogger {
  requestStarted(payload: AiRequestLogPayload): void;
  requestSucceeded(payload: AiRequestLogPayload): void;
  requestFailed(payload: AiRequestLogPayload, error: unknown): void;
}

export interface CreateAiRequestLogPayloadInput {
  readonly providerId: string;
  readonly operation: AiOperationName;
  readonly model?: string;
  readonly metadata?: AiRequestMetadata;
  readonly input?: string;
  readonly logFullInput?: boolean;
}

export class NestAiRequestLogger implements AiRequestLogger {
  private readonly logger = new Logger('AiCore');

  requestStarted(payload: AiRequestLogPayload): void {
    this.logger.debug({ event: 'ai_request_started', ...payload });
  }

  requestSucceeded(payload: AiRequestLogPayload): void {
    this.logger.debug({ event: 'ai_request_succeeded', ...payload });
  }

  requestFailed(payload: AiRequestLogPayload, error: unknown): void {
    this.logger.warn({
      event: 'ai_request_failed',
      ...payload,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export function createAiRequestLogPayload(
  input: CreateAiRequestLogPayloadInput
): AiRequestLogPayload {
  return {
    providerId: input.providerId,
    operation: input.operation,
    ...(input.model === undefined ? {} : { model: input.model }),
    ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    ...(input.input === undefined
      ? {}
      : {
          inputCharCount: input.input.length,
          inputSha256: createHash('sha256').update(input.input).digest('hex'),
          ...(input.logFullInput === true ? { input: input.input } : {})
        })
  };
}
