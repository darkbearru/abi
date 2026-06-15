import { AiCoreModule } from '@abi/ai-core';
import { PromptsModule } from '@abi/prompts';
import { StorageModule } from '@abi/storage';
import { ValidationModule } from '@abi/validation';
import { Module } from '@nestjs/common';

import { BookChunkingModule } from './modules/book-chunking/book-chunking.module.js';
import { BookUploadModule } from './modules/book-upload/book-upload.module.js';
import { CharacterMergeModule } from './modules/character-merge/character-merge.module.js';
import { CharacterVisualPassportModule } from './modules/character-visual-passport/character-visual-passport.module.js';
import { ConsistencyValidationModule } from './modules/consistency-validation/consistency-validation.module.js';
import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module.js';
import { LocationMergeModule } from './modules/location-merge/location-merge.module.js';
import { LocationVisualPassportModule } from './modules/location-visual-passport/location-visual-passport.module.js';
import { SceneGenerationModule } from './modules/scene-generation/scene-generation.module.js';
import { TimelineMergeModule } from './modules/timeline-merge/timeline-merge.module.js';
import { VectorSearchModule } from './modules/vector-search/vector-search.module.js';
import { VisualStyleModule } from './modules/visual-style/visual-style.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    AiCoreModule,
    PromptsModule,
    StorageModule,
    ValidationModule,
    PrismaModule,
    BookChunkingModule,
    CharacterMergeModule,
    CharacterVisualPassportModule,
    ConsistencyValidationModule,
    LocationMergeModule,
    LocationVisualPassportModule,
    TimelineMergeModule,
    KnowledgeGraphModule,
    VectorSearchModule,
    SceneGenerationModule,
    VisualStyleModule,
    BookUploadModule
  ]
})
export class AppModule {}
