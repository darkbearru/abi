import { Injectable } from '@nestjs/common';

import { parseAndValidateJson } from './json-validation.js';
import {
  createAiRequestLogPayload,
  NestAiRequestLogger,
  type AiOperationName,
  type AiRequestLogger
} from './logging.js';
import type { OpenAiHttpClient } from './openai-http-client.js';
import {
  extractTextFromOpenAiResponse,
  extractUsageFromOpenAiResponse
} from './openai-response.js';
import { executeWithRetry } from './retry-policy.js';
import { DEFAULT_AI_TIMEOUT_MS, executeWithTimeout } from './timeout.js';
import type {
  AiRetryPolicy,
  AiStructuredRequest,
  AiTextProvider,
  AiTextRequest,
  AiTextResponse
} from './types.js';

export interface OpenAiTextProviderOptions {
  readonly id?: string;
  readonly defaultModel?: string;
  readonly structuredModel?: string;
  readonly retryPolicy?: AiRetryPolicy;
  readonly timeoutMs?: number;
  readonly logger?: AiRequestLogger;
  readonly logFullInput?: boolean;
}

@Injectable()
export class OpenAiTextProvider implements AiTextProvider {
  readonly id: string;
  private readonly defaultModel: string;
  private readonly structuredModel: string;
  private readonly retryPolicy: AiRetryPolicy | undefined;
  private readonly timeoutMs: number;
  private readonly logger: AiRequestLogger;
  private readonly logFullInput: boolean;

  constructor(
    private readonly httpClient: OpenAiHttpClient,
    options: OpenAiTextProviderOptions = {}
  ) {
    this.id = options.id ?? 'openai';
    this.defaultModel = options.defaultModel ?? 'gpt-4.1-mini';
    this.structuredModel = options.structuredModel ?? this.defaultModel;
    this.retryPolicy = options.retryPolicy;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
    this.logger = options.logger ?? new NestAiRequestLogger();
    this.logFullInput = options.logFullInput ?? false;
  }

  async extractStructuredData<T>(input: AiStructuredRequest<T>): Promise<T> {
    const response = await this.generateTextWithOperation({
      prompt: [
        input.prompt,
        'Return only valid JSON. Do not include markdown fences or explanatory text.'
      ].join('\n\n'),
      ...(input.systemPrompt === undefined ? {} : { systemPrompt: input.systemPrompt }),
      model: input.model ?? this.structuredModel,
      ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
      ...(input.maxOutputTokens === undefined ? {} : { maxOutputTokens: input.maxOutputTokens }),
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      ...(input.retryPolicy === undefined ? {} : { retryPolicy: input.retryPolicy }),
      ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs })
    }, 'extractStructuredData');

    return parseAndValidateJson(response.text, input.schema);
  }

  async generateText(input: AiTextRequest): Promise<AiTextResponse> {
    return this.generateTextWithOperation(input, 'generateText');
  }

  private async generateTextWithOperation(
    input: AiTextRequest,
    operation: AiOperationName
  ): Promise<AiTextResponse> {
    const model = input.model ?? this.defaultModel;
    const logPayload = createAiRequestLogPayload({
      providerId: this.id,
      operation,
      model,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      input: input.prompt,
      logFullInput: this.logFullInput
    });

    this.logger.requestStarted(logPayload);

    try {
      const raw = await executeWithRetry(
        () =>
          executeWithTimeout(
            ({ signal }) =>
              this.httpClient.postJson<unknown>(
                '/v1/responses',
                createOpenAiTextRequestBody(input, model),
                { signal }
              ),
            input.timeoutMs ?? this.timeoutMs
          ),
        { retryPolicy: input.retryPolicy ?? this.retryPolicy }
      );
      const usage = extractUsageFromOpenAiResponse(raw);
      const response: AiTextResponse = {
        providerId: this.id,
        text: extractTextFromOpenAiResponse(raw),
        model,
        ...(usage === undefined ? {} : { usage }),
        raw
      };

      this.logger.requestSucceeded(logPayload);

      return response;
    } catch (error) {
      this.logger.requestFailed(logPayload, error);
      throw error;
    }
  }
}

function createOpenAiTextRequestBody(input: AiTextRequest, model: string): Record<string, unknown> {
  const messages = [
    ...(input.systemPrompt === undefined ? [] : [{ role: 'system', content: input.systemPrompt }]),
    { role: 'user', content: input.prompt }
  ];

  return {
    model,
    input: messages,
    ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
    ...(input.maxOutputTokens === undefined ? {} : { max_output_tokens: input.maxOutputTokens })
  };
}
