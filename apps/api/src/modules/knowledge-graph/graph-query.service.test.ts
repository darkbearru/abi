import { describe, expect, it, vi } from 'vitest';

import { GraphQueryService } from './graph-query.service.js';
import { MockGraphRecord } from './graph-sync.service.test.js';
import type {
  GraphRecord,
  GraphStatement,
  KnowledgeGraphAdapter
} from './ports/knowledge-graph.adapter.js';

describe('GraphQueryService', () => {
  it('reads a project graph through the Neo4j adapter port', async () => {
    const adapter = createMockAdapter([
      [
        new MockGraphRecord({
          id: 'project-1:Character:character-1',
          labels: ['Character'],
          properties: { id: 'character-1', canonicalName: 'Mara' }
        })
      ],
      [
        new MockGraphRecord({
          id: 'rel-1',
          type: 'APPEARS_IN',
          source: 'project-1:Character:character-1',
          target: 'project-1:Scene:scene-1',
          properties: { projectId: 'project-1' }
        })
      ]
    ]);
    const service = new GraphQueryService(adapter);

    const graph = await service.getProjectGraph('project-1');

    expect(graph.nodes).toHaveLength(1);
    expect(graph.relationships).toHaveLength(1);
    expect(graph.nodes[0]?.properties.canonicalName).toBe('Mara');
    expect(graph.relationships[0]?.type).toBe('APPEARS_IN');
  });

  it('finds context and resolves scene entities with a mock Neo4j adapter', async () => {
    const adapter = createMockAdapter([
      [new MockGraphRecord({ id: 'project-1:Location:location-1', labels: ['Location'], properties: { id: 'location-1', name: 'Old Square' } })],
      [],
      [
        new MockGraphRecord({
          characterIds: ['character-1'],
          locationIds: ['location-1'],
          worldObjectIds: ['object-1']
        })
      ]
    ]);
    const service = new GraphQueryService(adapter);

    const context = await service.findLocationContext('project-1', 'Old Square');
    const entities = await service.resolveSceneEntities('project-1', 'scene-1');

    expect(context.nodes[0]?.properties.name).toBe('Old Square');
    expect(entities).toEqual({
      characterIds: ['character-1'],
      locationIds: ['location-1'],
      worldObjectIds: ['object-1']
    });
  });
});

function createMockAdapter(responses: readonly (readonly GraphRecord[])[]): KnowledgeGraphAdapter {
  const queue = [...responses];

  return {
    executeWrite: vi.fn(),
    executeRead<T>(
      _statement: GraphStatement,
      mapRecord: (record: GraphRecord) => T
    ): Promise<readonly T[]> {
      const records = queue.shift() ?? [];

      return Promise.resolve(records.map(mapRecord));
    }
  };
}
