import { Module } from '@nestjs/common';

import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { SceneEntityResolutionService } from './scene-entity-resolution.service.js';
import { SceneGenerationController } from './scene-generation.controller.js';
import { SceneGenerationService } from './scene-generation.service.js';
import { ScenePromptBuilderService } from './scene-prompt-builder.service.js';

@Module({
  imports: [
    PrismaModule,
    KnowledgeGraphModule,
    QueueModule
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
