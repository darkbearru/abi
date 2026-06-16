import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { GraphSyncService } from './graph-sync.service.js';
import type {
  GraphRecord,
  GraphStatement,
  KnowledgeGraphAdapter
} from './ports/knowledge-graph.adapter.js';

describe('GraphSyncService', () => {
  it('synchronizes project entities and relationships into Neo4j statements', async () => {
    const executeWrite = vi.fn<(statements: readonly GraphStatement[]) => Promise<void>>();
    const adapter: KnowledgeGraphAdapter = {
      executeWrite,
      executeRead: vi.fn()
    };
    const prisma = {
      userBookProject: {
        findUnique: vi.fn().mockResolvedValue(createProjectSource())
      }
    } as unknown as PrismaService;
    const service = new GraphSyncService(prisma, adapter);

    await service.syncProject('project-1');

    const statements = executeWrite.mock.calls[0]?.[0] ?? [];
    const cypher = statements.map((statement) => statement.cypher).join('\n');
    const params = statements.map((statement) => statement.params);

    expect(cypher).toContain('MERGE (n:Character');
    expect(cypher).toContain('MERGE (n:Location');
    expect(cypher).toContain('MERGE (n:TimelineEvent');
    expect(cypher).toContain('MERGE (from)-[relationship:VERSION_OF]->(to)');
    expect(cypher).toContain('MERGE (from)-[relationship:HAPPENS_AT]->(to)');
    expect(cypher).toContain('MERGE (from)-[relationship:BEFORE]->(to)');
    expect(params.some((param) => JSON.stringify(param).includes('Mara'))).toBe(true);
    expect(params.some((param) => JSON.stringify(param).includes('Old Square'))).toBe(true);

    const characterVersionStatement = statements.find((statement) =>
      JSON.stringify(statement.params).includes('character-version-1')
    );
    const characterVersionProps = characterVersionStatement?.params.props as
      | Record<string, unknown>
      | undefined;

    expect(characterVersionProps?.appearance).toBe(JSON.stringify({ hair: 'black' }));
    expect(characterVersionProps?.timelineRange).toBe(JSON.stringify({ phase: 'main' }));
  });
});

function createProjectSource(): Record<string, unknown> {
  const now = new Date('2026-01-01T00:00:00.000Z');

  return {
    id: 'project-1',
    userId: 'user-1',
    bookId: 'book-1',
    bookAnalysisId: 'analysis-1',
    name: 'Project',
    createdAt: now,
    updatedAt: now,
    book: {
      id: 'book-1',
      title: 'Book',
      author: 'Author',
      language: 'en',
      fileHash: 'file-hash',
      contentHash: 'content-hash',
      createdAt: now,
      updatedAt: now
    },
    books: [],
    series: null,
    scenes: [
      {
        id: 'scene-1',
        projectId: 'project-1',
        title: 'Opening scene',
        description: null,
        status: 'DRAFT',
        orderIndex: 0,
        prompt: null,
        characterId: 'character-1',
        locationId: 'location-1',
        visualStyleId: null,
        createdAt: now,
        updatedAt: now
      }
    ],
    worldBible: {
      id: 'world-bible-1',
      bookAnalysisId: 'analysis-1',
      projectId: 'project-1',
      summary: null,
      rules: null,
      createdAt: now,
      updatedAt: now,
      objects: [
        {
          id: 'object-1',
          worldBibleId: 'world-bible-1',
          name: 'Key',
          description: 'A brass key.',
          visualPrompt: null,
          metadata: {
            ownerCharacterId: 'character-1',
            locationId: 'location-1'
          },
          createdAt: now,
          updatedAt: now
        }
      ],
      characters: [
        {
          id: 'character-1',
          worldBibleId: 'world-bible-1',
          canonicalName: 'Mara',
          createdAt: now,
          updatedAt: now,
          aliases: [{ id: 'alias-1', characterId: 'character-1', alias: 'M', createdAt: now }],
          versions: [
            {
              id: 'character-version-1',
              characterId: 'character-1',
              version: 1,
              age: 'adult',
              timelineRange: { phase: 'main' },
              appearance: { hair: 'black' },
              personality: null,
              speechManner: null,
              clothing: null,
              visualPrompt: null,
              negativePrompt: null,
              confidenceScore: 0.9,
              sourceFactIds: ['fact-1'],
              createdAt: now
            }
          ],
          outgoing: [
            {
              id: 'relationship-1',
              sourceCharacterId: 'character-1',
              targetCharacterId: 'character-2',
              type: 'KNOWS',
              description: null,
              timelineRange: null,
              createdAt: now,
              updatedAt: now
            }
          ],
          incoming: []
        },
        {
          id: 'character-2',
          worldBibleId: 'world-bible-1',
          canonicalName: 'Ilya',
          createdAt: now,
          updatedAt: now,
          aliases: [],
          versions: [],
          outgoing: [],
          incoming: []
        }
      ],
      locations: [
        {
          id: 'location-1',
          worldBibleId: 'world-bible-1',
          name: 'Old Square',
          parentId: null,
          createdAt: now,
          updatedAt: now,
          aliases: [],
          versions: [
            {
              id: 'location-version-1',
              locationId: 'location-1',
              version: 1,
              description: 'Stone square.',
              atmosphere: null,
              palette: null,
              era: null,
              socialContext: null,
              lightingRules: null,
              architectureRules: null,
              recurringObjects: null,
              referenceAssetIds: [],
              confidenceScore: 0.8,
              sourceFactIds: ['fact-2'],
              createdAt: now
            }
          ]
        }
      ],
      timelineEvents: [
        {
          id: 'event-1',
          worldBibleId: 'world-bible-1',
          title: 'Mara arrives',
          description: 'Mara arrives at the square.',
          chapterIndex: 1,
          absoluteDate: null,
          relativeOrder: 1000,
          orderIndex: 0,
          timelineRange: null,
          relativeMarkers: null,
          involvedCharacterIds: ['character-1'],
          involvedLocationIds: ['location-1'],
          sourceChunkIds: ['chunk-1'],
          confidence: 0.9,
          characterId: 'character-1',
          locationId: 'location-1',
          createdAt: now,
          updatedAt: now,
          characterVersions: [
            {
              id: 'event-version-link-1',
              timelineEventId: 'event-1',
              characterVersionId: 'character-version-1',
              createdAt: now
            }
          ]
        },
        {
          id: 'event-2',
          worldBibleId: 'world-bible-1',
          title: 'Mara leaves',
          description: null,
          chapterIndex: 2,
          absoluteDate: null,
          relativeOrder: 2000,
          orderIndex: 1,
          timelineRange: null,
          relativeMarkers: null,
          involvedCharacterIds: ['character-1'],
          involvedLocationIds: ['location-1'],
          sourceChunkIds: ['chunk-2'],
          confidence: 0.8,
          characterId: 'character-1',
          locationId: 'location-1',
          createdAt: now,
          updatedAt: now,
          characterVersions: []
        }
      ]
    },
    bookAnalysis: {
      worldBible: null
    }
  };
}

export class MockGraphRecord implements GraphRecord {
  constructor(private readonly values: Readonly<Record<string, unknown>>) {}

  get(key: string): unknown {
    return this.values[key];
  }
}
