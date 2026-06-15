import { Injectable } from '@nestjs/common';

import { parseAndValidateJson } from './json-validation.js';
import type {
  AiImageEditRequest,
  AiImageGenerationRequest,
  AiImageGenerationResponse,
  AiImageProvider,
  AiStructuredRequest,
  AiTextProvider,
  AiTextRequest,
  AiTextResponse
} from './types.js';

export interface MockAiProviderOptions {
  readonly id?: string;
  readonly textResponses?: readonly string[];
  readonly structuredResponses?: readonly unknown[];
  readonly imageResponses?: readonly AiImageGenerationResponse[];
  readonly generateText?: (input: AiTextRequest) => Promise<AiTextResponse>;
  readonly extractStructuredData?: <T>(input: AiStructuredRequest<T>) => Promise<T>;
  readonly generateImage?: (input: AiImageGenerationRequest) => Promise<AiImageGenerationResponse>;
  readonly editImage?: (input: AiImageEditRequest) => Promise<AiImageGenerationResponse>;
}

@Injectable()
export class MockAiProvider implements AiTextProvider, AiImageProvider {
  readonly id: string;
  private textResponseIndex = 0;
  private structuredResponseIndex = 0;
  private imageResponseIndex = 0;

  constructor(private readonly options: MockAiProviderOptions = {}) {
    this.id = options.id ?? 'mock';
  }

  async extractStructuredData<T>(input: AiStructuredRequest<T>): Promise<T> {
    if (this.options.extractStructuredData) {
      return this.options.extractStructuredData(input);
    }

    const response = this.nextStructuredResponse();

    if (typeof response === 'string') {
      return parseAndValidateJson(response, input.schema);
    }

    return input.schema.parse(response);
  }

  async generateText(input: AiTextRequest): Promise<AiTextResponse> {
    if (this.options.generateText) {
      return this.options.generateText(input);
    }

    return {
      providerId: this.id,
      text: this.nextTextResponse() ?? input.prompt,
      ...(input.model === undefined ? {} : { model: input.model })
    };
  }

  async generateImage(input: AiImageGenerationRequest): Promise<AiImageGenerationResponse> {
    if (this.options.generateImage) {
      return this.options.generateImage(input);
    }

    return this.nextImageResponse(input.model);
  }

  async editImage(input: AiImageEditRequest): Promise<AiImageGenerationResponse> {
    if (this.options.editImage) {
      return this.options.editImage(input);
    }

    return this.nextImageResponse(input.model);
  }

  private nextTextResponse(): string | undefined {
    const response = this.options.textResponses?.[this.textResponseIndex];

    this.textResponseIndex += 1;

    return response;
  }

  private nextStructuredResponse(): unknown {
    const response = this.options.structuredResponses?.[this.structuredResponseIndex];

    this.structuredResponseIndex += 1;

    return response ?? {};
  }

  private nextImageResponse(model: string | undefined): AiImageGenerationResponse {
    const response = this.options.imageResponses?.[this.imageResponseIndex];

    this.imageResponseIndex += 1;

    return response ?? { providerId: this.id, images: [], ...(model === undefined ? {} : { model }) };
  }
}
