import { DynamicModule, Global, Module } from '@nestjs/common';

import { FetchOpenAiHttpClient, type FetchOpenAiHttpClientOptions } from './openai-http-client.js';
import { OpenAiImageProvider, type OpenAiImageProviderOptions } from './openai-image.provider.js';
import { OpenAiTextProvider, type OpenAiTextProviderOptions } from './openai-text.provider.js';
import {
  AI_IMAGE_PROVIDERS,
  AI_TEXT_PROVIDERS,
  AiProviderRegistry
} from './provider-registry.js';
import type { AiImageProvider, AiTextProvider } from './types.js';

export interface AiCoreOpenAiOptions extends FetchOpenAiHttpClientOptions {
  readonly text?: Omit<OpenAiTextProviderOptions, 'id'>;
  readonly image?: Omit<OpenAiImageProviderOptions, 'id'>;
}

export interface AiCoreModuleOptions {
  readonly textProviders?: readonly AiTextProvider[];
  readonly imageProviders?: readonly AiImageProvider[];
  readonly openAi?: AiCoreOpenAiOptions;
}

@Global()
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
export class AiCoreModule {
  static register(options: AiCoreModuleOptions = {}): DynamicModule {
    const configured = createConfiguredProviders(options);

    return {
      module: AiCoreModule,
      providers: [
        {
          provide: AI_TEXT_PROVIDERS,
          useValue: configured.textProviders
        },
        {
          provide: AI_IMAGE_PROVIDERS,
          useValue: configured.imageProviders
        },
        AiProviderRegistry
      ],
      exports: [AI_TEXT_PROVIDERS, AI_IMAGE_PROVIDERS, AiProviderRegistry]
    };
  }

  static forRoot(options: AiCoreModuleOptions = {}): DynamicModule {
    return AiCoreModule.register(options);
  }
}

function createConfiguredProviders(options: AiCoreModuleOptions): {
  readonly textProviders: readonly AiTextProvider[];
  readonly imageProviders: readonly AiImageProvider[];
} {
  const textProviders = [...(options.textProviders ?? [])];
  const imageProviders = [...(options.imageProviders ?? [])];

  if (options.openAi) {
    const httpClient = new FetchOpenAiHttpClient(options.openAi);

    textProviders.push(
      new OpenAiTextProvider(httpClient, {
        id: 'openai',
        ...(options.openAi.text ?? {})
      })
    );
    imageProviders.push(
      new OpenAiImageProvider(httpClient, {
        id: 'openai',
        ...(options.openAi.image ?? {})
      })
    );
  }

  return { textProviders, imageProviders };
}
