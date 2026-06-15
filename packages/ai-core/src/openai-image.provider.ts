import { Injectable } from '@nestjs/common';

import { createAiRequestLogPayload, NestAiRequestLogger, type AiRequestLogger } from './logging.js';
import type { OpenAiHttpClient } from './openai-http-client.js';
import { extractImagesFromOpenAiResponse } from './openai-response.js';
import { executeWithRetry } from './retry-policy.js';
import { DEFAULT_AI_TIMEOUT_MS, executeWithTimeout } from './timeout.js';
import type {
  AiImageEditAsset,
  AiImageEditRequest,
  AiImageGenerationRequest,
  AiImageGenerationResponse,
  AiImageProvider,
  AiRetryPolicy
} from './types.js';

export interface OpenAiImageProviderOptions {
  readonly id?: string;
  readonly defaultModel?: string;
  readonly retryPolicy?: AiRetryPolicy;
  readonly timeoutMs?: number;
  readonly logger?: AiRequestLogger;
  readonly logFullInput?: boolean;
}

@Injectable()
export class OpenAiImageProvider implements AiImageProvider {
  readonly id: string;
  private readonly defaultModel: string;
  private readonly retryPolicy: AiRetryPolicy | undefined;
  private readonly timeoutMs: number;
  private readonly logger: AiRequestLogger;
  private readonly logFullInput: boolean;

  constructor(
    private readonly httpClient: OpenAiHttpClient,
    options: OpenAiImageProviderOptions = {}
  ) {
    this.id = options.id ?? 'openai';
    this.defaultModel = options.defaultModel ?? 'gpt-image-1';
    this.retryPolicy = options.retryPolicy;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
    this.logger = options.logger ?? new NestAiRequestLogger();
    this.logFullInput = options.logFullInput ?? false;
  }

  async generateImage(input: AiImageGenerationRequest): Promise<AiImageGenerationResponse> {
    const model = input.model ?? this.defaultModel;
    const logPayload = createAiRequestLogPayload({
      providerId: this.id,
      operation: 'generateImage',
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
                '/v1/images/generations',
                {
                  model,
                  prompt: input.prompt,
                  ...(input.size === undefined ? {} : { size: input.size }),
                  n: input.count ?? 1
                },
                { signal }
              ),
            input.timeoutMs ?? this.timeoutMs
          ),
        { retryPolicy: input.retryPolicy ?? this.retryPolicy }
      );
      const response = {
        providerId: this.id,
        images: extractImagesFromOpenAiResponse(raw),
        model,
        raw
      };

      this.logger.requestSucceeded(logPayload);

      return response;
    } catch (error) {
      this.logger.requestFailed(logPayload, error);
      throw error;
    }
  }

  async editImage(input: AiImageEditRequest): Promise<AiImageGenerationResponse> {
    const model = input.model ?? this.defaultModel;
    const logPayload = createAiRequestLogPayload({
      providerId: this.id,
      operation: 'editImage',
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
              this.httpClient.postForm<unknown>(
                '/v1/images/edits',
                createImageEditFormData(input, model),
                { signal }
              ),
            input.timeoutMs ?? this.timeoutMs
          ),
        { retryPolicy: input.retryPolicy ?? this.retryPolicy }
      );
      const response = {
        providerId: this.id,
        images: extractImagesFromOpenAiResponse(raw),
        model,
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

function createImageEditFormData(input: AiImageEditRequest, model: string): FormData {
  const form = new FormData();

  form.set('model', model);
  form.set('prompt', input.prompt);
  form.set('image', toBlob(input.image), input.image.filename);

  if (input.mask) {
    form.set('mask', toBlob(input.mask), input.mask.filename);
  }

  if (input.size) {
    form.set('size', input.size);
  }

  form.set('n', String(input.count ?? 1));

  return form;
}

function toBlob(asset: AiImageEditAsset): Blob {
  const buffer = new ArrayBuffer(asset.bytes.byteLength);
  const copy = new Uint8Array(buffer);

  copy.set(asset.bytes);

  return new Blob([buffer], { type: asset.mimeType });
}
