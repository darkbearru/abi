import { StorageModule } from '@abi/storage';
import { Module } from '@nestjs/common';

import { ConsistencyValidationModule } from '../consistency-validation/consistency-validation.module.js';
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { LocalSceneStorageProvider } from './local-scene-storage.provider.js';
import { SceneEntityResolutionService } from './scene-entity-resolution.service.js';
import { SceneGenerationController } from './scene-generation.controller.js';
import { SceneGenerationService } from './scene-generation.service.js';
import { ScenePromptBuilderService } from './scene-prompt-builder.service.js';

@Module({
  imports: [
    PrismaModule,
    ConsistencyValidationModule,
    KnowledgeGraphModule,
    StorageModule.register({
      provider: new LocalSceneStorageProvider()
    })
  ],
  controllers: [SceneGenerationController],
  providers: [
    SceneEntityResolutionService,
    ScenePromptBuilderService,
    SceneGenerationService
  ],
  exports: [
    SceneEntityResolutionService,
    ScenePromptBuilderService,
    SceneGenerationService
  ]
})
export class SceneGenerationModule {}
