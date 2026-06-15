import type { ZodType } from 'zod';

export interface AiUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

export interface AiRetryPolicy {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs?: number;
  readonly backoffMultiplier?: number;
  readonly retryableStatusCodes?: readonly number[];
}

export interface AiExecutionOptions {
  readonly retryPolicy?: AiRetryPolicy;
  readonly timeoutMs?: number;
}

export interface AiRequestMetadata {
  readonly userId?: string;
  readonly bookId?: string;
  readonly bookAnalysisId?: string;
  readonly generationJobId?: string;
  readonly purpose?: string;
  readonly tags?: readonly string[];
}

export interface AiTextRequest extends AiExecutionOptions {
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly metadata?: AiRequestMetadata;
}

export interface AiTextResponse {
  readonly providerId: string;
  readonly text: string;
  readonly model?: string;
  readonly usage?: AiUsage;
  readonly raw?: unknown;
}

export interface AiStructuredRequest<T> extends AiExecutionOptions {
  readonly prompt: string;
  readonly schema: ZodType<T>;
  readonly systemPrompt?: string;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly metadata?: AiRequestMetadata;
}

export interface AiGeneratedImage {
  readonly b64Json?: string;
  readonly url?: string;
  readonly mimeType?: string;
}

export interface AiImageGenerationRequest extends AiExecutionOptions {
  readonly prompt: string;
  readonly model?: string;
  readonly size?: string;
  readonly count?: number;
  readonly metadata?: AiRequestMetadata;
}

export interface AiImageEditAsset {
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly mimeType: string;
}

export interface AiImageEditRequest extends AiExecutionOptions {
  readonly prompt: string;
  readonly image: AiImageEditAsset;
  readonly mask?: AiImageEditAsset;
  readonly model?: string;
  readonly size?: string;
  readonly count?: number;
  readonly metadata?: AiRequestMetadata;
}

export interface AiImageGenerationResponse {
  readonly providerId: string;
  readonly images: readonly AiGeneratedImage[];
  readonly model?: string;
  readonly raw?: unknown;
}

export interface AiTextProvider {
  readonly id: string;
  extractStructuredData<T>(input: AiStructuredRequest<T>): Promise<T>;
  generateText(input: AiTextRequest): Promise<AiTextResponse>;
}

export interface AiImageProvider {
  readonly id: string;
  generateImage(input: AiImageGenerationRequest): Promise<AiImageGenerationResponse>;
  editImage(input: AiImageEditRequest): Promise<AiImageGenerationResponse>;
}
