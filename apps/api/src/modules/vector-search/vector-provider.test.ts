import { describe, expect, it } from 'vitest';

import { HashEmbeddingService } from './embedding.service.js';
import { MockVectorProvider } from './mock-vector.provider.js';

describe('VectorProvider abstraction', () => {
  it('upserts, filters, searches and deletes vector points', async () => {
    const embeddings = new HashEmbeddingService();
    const provider = new MockVectorProvider();

    await provider.ensureCollection(embeddings.vectorSize);
    await provider.upsert([
      {
        id: 'point-1',
        vector: embeddings.embed('Mara walks through the old square'),
        payload: {
          projectId: 'project-1',
          entityType: 'BookChunk',
          entityId: 'chunk-1',
          sourceEntity: 'BookChunk',
          title: 'Chunk 1',
          text: 'Mara walks through the old square.'
        }
      },
      {
        id: 'point-2',
        vector: embeddings.embed('A winter forest surrounds the city'),
        payload: {
          projectId: 'project-2',
          entityType: 'LocationVersion',
          entityId: 'location-version-1',
          sourceEntity: 'LocationVersion',
          title: 'Forest',
          text: 'A winter forest surrounds the city.'
        }
      }
    ]);

    const results = await provider.search(
      embeddings.embed('old square Mara'),
      { projectId: 'project-1' },
      5
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.payload.sourceEntity).toBe('BookChunk');
    expect(results[0]?.score).toBeGreaterThan(0);

    await provider.deleteByFilter({ projectId: 'project-1' });

    await expect(
      provider.search(embeddings.embed('old square Mara'), { projectId: 'project-1' }, 5)
    ).resolves.toEqual([]);
  });
});
