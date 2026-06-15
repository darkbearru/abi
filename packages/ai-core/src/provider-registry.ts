import { Inject, Injectable, Module, Optional } from '@nestjs/common';

import { AiProviderNotFoundError } from './errors.js';
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

export const AI_TEXT_PROVIDERS = 'ABI_AI_TEXT_PROVIDERS';
export const AI_IMAGE_PROVIDERS = 'ABI_AI_IMAGE_PROVIDERS';

@Injectable()
export class AiProviderRegistry {
  constructor(
    @Optional()
    @Inject(AI_TEXT_PROVIDERS)
    private readonly textProviders: readonly AiTextProvider[] = [],
    @Optional()
    @Inject(AI_IMAGE_PROVIDERS)
    private readonly imageProviders: readonly AiImageProvider[] = []
  ) {}

  listTextProviders(): readonly AiTextProvider[] {
    return this.textProviders;
  }

  listImageProviders(): readonly AiImageProvider[] {
    return this.imageProviders;
  }

  getTextProvider(providerId: string): AiTextProvider {
    const provider = this.textProviders.find((candidate) => candidate.id === providerId);

    if (!provider) {
      throw new AiProviderNotFoundError(providerId, 'text');
    }

    return provider;
  }

  getImageProvider(providerId: string): AiImageProvider {
    const provider = this.imageProviders.find((candidate) => candidate.id === providerId);

    if (!provider) {
      throw new AiProviderNotFoundError(providerId, 'image');
    }

    return provider;
  }

  extractStructuredData<T>(
    providerId: string,
    input: AiStructuredRequest<T>
  ): Promise<T> {
    return this.getTextProvider(providerId).extractStructuredData(input);
  }

  generateText(providerId: string, input: AiTextRequest): Promise<AiTextResponse> {
    return this.getTextProvider(providerId).generateText(input);
  }

  generateImage(
    providerId: string,
    input: AiImageGenerationRequest
  ): Promise<AiImageGenerationResponse> {
    return this.getImageProvider(providerId).generateImage(input);
  }

  editImage(
    providerId: string,
    input: AiImageEditRequest
  ): Promise<AiImageGenerationResponse> {
    return this.getImageProvider(providerId).editImage(input);
  }
}

@Module({
  providers: [
    {
      provide: AI_TEXT_PROVIDERS,
      useValue: []
    },
    {
      provide: AI_IMAGE_PROVIDERS,
      useValue: []
    },
    AiProviderRegistry
  ],
  exports: [AI_TEXT_PROVIDERS, AI_IMAGE_PROVIDERS, AiProviderRegistry]
})
export class AiProviderRegistryModule {}
