import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { SceneEntityResolutionService } from './scene-entity-resolution.service.js';

describe('SceneEntityResolutionService', () => {
  it('returns candidates for ambiguous entity mentions and resolves inflected location names', async () => {
    const prisma = {
      userBookProject: {
        findUnique: vi.fn().mockResolvedValue({
          worldBible: { id: 'world-bible-1' },
          bookAnalysis: null
        })
      },
      character: {
        findMany: vi.fn().mockResolvedValue([
          createCharacter('character-1', 'Джон Смит', ['Джон']),
          createCharacter('character-2', 'Джон Блэк', ['Джон'])
        ])
      },
      location: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'location-1',
            worldBibleId: 'world-bible-1',
            name: 'Фонтан',
            parentId: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            aliases: [],
            versions: [
              {
                id: 'location-version-1',
                locationId: 'location-1',
                version: 1,
                description: 'старый фонтан в городском парке',
                atmosphere: null,
                palette: null,
                era: null,
                socialContext: null,
                lightingRules: null,
                architectureRules: null,
                recurringObjects: null,
                referenceAssetIds: [],
                confidenceScore: 0.9,
                sourceFactIds: [],
                createdAt: new Date('2026-01-01T00:00:00.000Z')
              }
            ]
          }
        ])
      },
      worldObject: {
        findMany: vi.fn().mockResolvedValue([])
      }
    } as unknown as PrismaService;
    const service = new SceneEntityResolutionService(prisma);

    const result = await service.resolve(
      'project-1',
      'Джон разговаривает с Майклом возле фонтана.'
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.mention).toBe('Джон');
    expect(result.candidates[0]?.candidates).toHaveLength(2);
    expect(result.locations[0]?.name).toBe('Фонтан');
    expect(result.createSuggestions.some((suggestion) => suggestion.mention === 'Майклом')).toBe(true);
  });
});

function createCharacter(
  id: string,
  canonicalName: string,
  aliases: readonly string[]
): Record<string, unknown> {
  return {
    id,
    worldBibleId: 'world-bible-1',
    canonicalName,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    aliases: aliases.map((alias, index) => ({
      id: `alias-${id}-${String(index)}`,
      characterId: id,
      alias,
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    })),
    versions: [
      {
        id: `${id}-version-1`,
        characterId: id,
        version: 1,
        age: 'adult',
        timelineRange: null,
        appearance: { hair: 'dark' },
        personality: null,
        speechManner: null,
        clothing: null,
        visualPrompt: null,
        negativePrompt: null,
        confidenceScore: 0.9,
        sourceFactIds: [],
        createdAt: new Date('2026-01-01T00:00:00.000Z')
      }
    ]
  };
}
