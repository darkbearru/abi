import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { HashEmbeddingService } from './embedding.service.js';
import { QdrantVectorProvider } from './qdrant-vector.provider.js';
import { VECTOR_PROVIDER } from './ports/vector-provider.js';
import { VectorIndexService } from './vector-index.service.js';
import { VectorSearchController } from './vector-search.controller.js';
import { VectorSearchService } from './vector-search.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [VectorSearchController],
  providers: [
    HashEmbeddingService,
    QdrantVectorProvider,
    {
      provide: VECTOR_PROVIDER,
      useExisting: QdrantVectorProvider
    },
    VectorIndexService,
    VectorSearchService
  ],
  exports: [HashEmbeddingService, VectorIndexService, VectorSearchService, VECTOR_PROVIDER]
})
export class VectorSearchModule {}
