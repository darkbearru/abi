import { AiCoreModule, AiProviderRegistry } from '@abi/ai-core';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { ConsistencyValidationController } from './consistency-validation.controller.js';
import { ConsistencyValidationService } from './consistency-validation.service.js';
import { LlmVisionValidationProvider } from './llm-vision-validation.provider.js';
import { MockImageValidationProvider } from './mock-image-validation.provider.js';
import { IMAGE_VALIDATION_PROVIDER } from './ports/image-validation.provider.js';

@Module({
  imports: [AiCoreModule, PrismaModule],
  controllers: [ConsistencyValidationController],
  providers: [
    MockImageValidationProvider,
    LlmVisionValidationProvider,
    {
      provide: IMAGE_VALIDATION_PROVIDER,
      inject: [AiProviderRegistry],
      useFactory: (aiProviders: AiProviderRegistry) =>
        process.env.CONSISTENCY_VALIDATION_PROVIDER === 'llm'
          ? new LlmVisionValidationProvider(aiProviders)
          : new MockImageValidationProvider()
    },
    ConsistencyValidationService
  ],
  exports: [ConsistencyValidationService, IMAGE_VALIDATION_PROVIDER]
})
export class ConsistencyValidationModule {}
