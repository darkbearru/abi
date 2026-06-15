import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import type {
  SemanticSearchResponseDto,
  SemanticSearchResultDto
} from './dto/search.response.dto.js';
import { HashEmbeddingService } from './embedding.service.js';
import {
  VECTOR_PROVIDER,
  type VectorProvider,
  type VectorSearchResult
} from './ports/vector-provider.js';
import { VectorIndexService } from './vector-index.service.js';

@Injectable()
export class VectorSearchService {
  constructor(
    @Inject(HashEmbeddingService)
    private readonly embeddings: HashEmbeddingService,
    @Inject(VectorIndexService)
    private readonly index: VectorIndexService,
    @Inject(VECTOR_PROVIDER)
    private readonly vectors: VectorProvider
  ) {}

  async searchProject(
    projectId: string,
    query: string,
    limit = 10
  ): Promise<SemanticSearchResponseDto> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new BadRequestException('Search query must not be empty.');
    }

    await this.index.indexProject(projectId);
    await this.vectors.ensureCollection(this.embeddings.vectorSize);

    const results = await this.vectors.search(
      this.embeddings.embed(normalizedQuery),
      { projectId },
      normalizeLimit(limit)
    );

    return {
      query: normalizedQuery,
      results: results.map(toDto)
    };
  }
}

function toDto(result: VectorSearchResult): SemanticSearchResultDto {
  return {
    entityType: result.payload.entityType,
    entityId: result.payload.entityId,
    sourceEntity: result.payload.sourceEntity,
    relevanceScore: result.score,
    ...(result.payload.title === undefined ? {} : { title: result.payload.title }),
    text: result.payload.text,
    ...(result.payload.metadata === undefined ? {} : { metadata: result.payload.metadata })
  };
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 10;
  }

  return Math.min(50, Math.max(1, Math.floor(limit)));
}
