import { describe, expect, it, vi } from 'vitest';

import { HashEmbeddingService } from './embedding.service.js';
import { MockVectorProvider } from './mock-vector.provider.js';
import type { VectorIndexService } from './vector-index.service.js';
import { VectorSearchService } from './vector-search.service.js';

describe('VectorSearchService', () => {
  it('returns source entity and relevance score', async () => {
    const embeddings = new HashEmbeddingService();
    const provider = new MockVectorProvider();
    const index = {
      indexProject: vi.fn(async () => {
        await provider.ensureCollection(embeddings.vectorSize);
        await provider.upsert([
          {
            id: 'point-1',
            vector: embeddings.embed('Mara in the old square'),
            payload: {
              projectId: 'project-1',
              entityType: 'TimelineEvent',
              entityId: 'event-1',
              sourceEntity: 'TimelineEvent',
              title: 'Mara arrives',
              text: 'Mara arrives in the old square.',
              metadata: {
                chapterIndex: 1
              }
            }
          }
        ]);
      })
    };
    const service = new VectorSearchService(
      embeddings,
      index as unknown as VectorIndexService,
      provider
    );

    const response = await service.searchProject('project-1', 'old square Mara');

    expect(index.indexProject).toHaveBeenCalledWith('project-1');
    expect(response.results[0]).toMatchObject({
      entityType: 'TimelineEvent',
      entityId: 'event-1',
      sourceEntity: 'TimelineEvent',
      title: 'Mara arrives'
    });
    expect(response.results[0]?.relevanceScore).toBeGreaterThan(0);
  });
});
