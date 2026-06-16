import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GraphQueryService } from '../knowledge-graph/graph-query.service.js';
import type { QueueService } from '../queue/queue.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { SceneGenerationStatusDto } from './dto/scene-generation.dto.js';
import type {
  SceneEntityResolutionResult,
  SceneEntityResolutionService
} from './scene-entity-resolution.service.js';
import { SceneGenerationService } from './scene-generation.service.js';
import { ScenePromptBuilderService } from './scene-prompt-builder.service.js';

describe('SceneGenerationService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns missingReferences and does not create a scene when approved passports are absent', async () => {
    const resolution = createResolution();
    const resolver = {
      resolve: vi.fn().mockResolvedValue(resolution)
    } as unknown as SceneEntityResolutionService;
    const sceneCreate = vi.fn();
    const prisma = {
      visualStyle: {
        findUnique: vi.fn().mockResolvedValue(createVisualStyle())
      },
      asset: {
        findMany: vi.fn().mockResolvedValue([])
      },
      scene: {
        create: sceneCreate
      }
    } as unknown as PrismaService;
    const graph = {
      findCharacterContext: vi.fn().mockResolvedValue({ nodes: [], relationships: [] }),
      findLocationContext: vi.fn().mockResolvedValue({ nodes: [], relationships: [] })
    } as unknown as GraphQueryService;
    const service = new SceneGenerationService(
      prisma,
      resolver,
      graph,
      new ScenePromptBuilderService(),
      { createJob: vi.fn() } as unknown as QueueService
    );

    const response = await service.generate('project-1', {
      text: 'John talks near the fountain.',
      styleId: 'style-1'
    }, 'user-1');

    expect(response.status).toBe(SceneGenerationStatusDto.MISSING_REFERENCES);
    expect(response.missingReferences).toHaveLength(2);
    expect(response.missingReferences.map((item) => item.versionId)).toEqual([
      'character-version-1',
      'location-version-1'
    ]);
    expect(sceneCreate).not.toHaveBeenCalled();
  });

  it('creates scene and queues image generation when references are approved', async () => {
    vi.stubEnv('SCENE_IMAGE_PROVIDER', 'mock-image');

    const resolution = createResolution();
    const resolver = {
      resolve: vi.fn().mockResolvedValue(resolution)
    } as unknown as SceneEntityResolutionService;
    const now = new Date('2026-01-01T00:00:00.000Z');
    const sceneCreate = vi.fn().mockResolvedValue({
      id: 'scene-1',
      projectId: 'project-1',
      title: 'John talks near the fountain.',
      description: 'John talks near the fountain.',
      status: 'GENERATING',
      orderIndex: 0,
      prompt: 'prompt',
      characterId: 'character-1',
      locationId: 'location-1',
      visualStyleId: 'style-1',
      createdAt: now,
      updatedAt: now
    });
    const prisma = {
      visualStyle: {
        findUnique: vi.fn().mockResolvedValue(createVisualStyle())
      },
      asset: {
        findMany: vi.fn().mockResolvedValue([
          createReferenceAsset('asset-character-1', 'CHARACTER_VERSION', 'character-version-1'),
          createReferenceAsset('asset-location-1', 'LOCATION_VERSION', 'location-version-1')
        ])
      },
      scene: {
        aggregate: vi.fn().mockResolvedValue({ _max: { orderIndex: null } }),
        create: sceneCreate
      }
    } as unknown as PrismaService;
    const graph = {
      findCharacterContext: vi.fn().mockResolvedValue({ nodes: [], relationships: [] }),
      findLocationContext: vi.fn().mockResolvedValue({ nodes: [], relationships: [] })
    } as unknown as GraphQueryService;
    const createJob = vi.fn().mockResolvedValue({
      id: 'job-1',
      queueName: 'image-generation',
      name: 'generate-scene',
      status: 'QUEUED',
      progress: 0
    });
    const service = new SceneGenerationService(
      prisma,
      resolver,
      graph,
      new ScenePromptBuilderService(),
      { createJob } as unknown as QueueService
    );

    const response = await service.generate('project-1', {
      text: 'John talks near the fountain.',
      styleId: 'style-1',
      aspectRatio: '16:9'
    }, 'user-1');

    expect(response.status).toBe(SceneGenerationStatusDto.QUEUED);
    expect(response.sceneId).toBe('scene-1');
    expect(response.generationJobId).toBe('job-1');
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        queueName: 'image-generation',
        name: 'generate-scene',
        projectId: 'project-1',
        userId: 'user-1',
        sceneId: 'scene-1'
      })
    );
  });

  it('does not block generation on create suggestions when known entities were resolved', async () => {
    const resolution = createResolution({
      createSuggestions: [{ mention: 'Michael', entityType: 'unknown' }]
    });
    const resolver = {
      resolve: vi.fn().mockResolvedValue(resolution)
    } as unknown as SceneEntityResolutionService;
    const prisma = {
      visualStyle: {
        findUnique: vi.fn().mockResolvedValue(createVisualStyle())
      },
      asset: {
        findMany: vi.fn().mockResolvedValue([
          createReferenceAsset('asset-character-1', 'CHARACTER_VERSION', 'character-version-1'),
          createReferenceAsset('asset-location-1', 'LOCATION_VERSION', 'location-version-1')
        ])
      },
      scene: {
        aggregate: vi.fn().mockResolvedValue({ _max: { orderIndex: null } }),
        create: vi.fn().mockResolvedValue({
          id: 'scene-1',
          projectId: 'project-1',
          title: 'John talks with Michael near the fountain.',
          description: 'John talks with Michael near the fountain.',
          status: 'GENERATING',
          orderIndex: 0,
          prompt: 'prompt',
          characterId: 'character-1',
          locationId: 'location-1',
          visualStyleId: 'style-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z')
        })
      }
    } as unknown as PrismaService;
    const graph = {
      findCharacterContext: vi.fn().mockResolvedValue({ nodes: [], relationships: [] }),
      findLocationContext: vi.fn().mockResolvedValue({ nodes: [], relationships: [] })
    } as unknown as GraphQueryService;
    const createJob = vi.fn().mockResolvedValue({
      id: 'job-1',
      queueName: 'image-generation',
      name: 'generate-scene',
      status: 'QUEUED',
      progress: 0
    });
    const service = new SceneGenerationService(
      prisma,
      resolver,
      graph,
      new ScenePromptBuilderService(),
      { createJob } as unknown as QueueService
    );

    const response = await service.generate(
      'project-1',
      {
        text: 'John talks with Michael near the fountain.',
        styleId: 'style-1'
      },
      'user-1'
    );

    expect(response.status).toBe(SceneGenerationStatusDto.QUEUED);
    expect(response.createSuggestions).toEqual([{ mention: 'Michael', entityType: 'unknown' }]);
  });
});

function createResolution(
  overrides: Partial<Pick<SceneEntityResolutionResult, 'createSuggestions'>> = {}
): SceneEntityResolutionResult {
  return {
    worldBibleId: 'world-bible-1',
    candidates: [],
    createSuggestions: [],
    characters: [
      {
        id: 'character-1',
        name: 'John',
        aliases: [],
        version: {
          id: 'character-version-1',
          characterId: 'character-1',
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
      }
    ],
    locations: [
      {
        id: 'location-1',
        name: 'Fountain',
        aliases: [],
        version: {
          id: 'location-version-1',
          locationId: 'location-1',
          version: 1,
          description: 'marble fountain',
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
      }
    ],
    objects: [],
    ...overrides
  };
}

function createVisualStyle(): Record<string, unknown> {
  return {
    id: 'style-1',
    slug: 'cinematic-realism',
    name: 'Cinematic Realism',
    description: null,
    prompt: 'grounded cinematic realism',
    negativePrompt: 'cartoon',
    primaryColor: null,
    secondaryColor: null,
    accentColor: null,
    contrastLevel: null,
    saturationLevel: null,
    grainLevel: null,
    lineThickness: null,
    isDefault: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  };
}

function createReferenceAsset(
  id: string,
  entityType: string,
  entityId: string
): Record<string, unknown> {
  return {
    id,
    projectId: 'project-1',
    sceneId: null,
    jobId: null,
    type: 'REFERENCE',
    approvalStatus: 'APPROVED',
    localPath: `${entityType}/${entityId}.png`,
    mimeType: 'image/png',
    width: null,
    height: null,
    prompt: 'reference prompt',
    seed: null,
    model: null,
    provider: null,
    entityType,
    entityId,
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  };
}
