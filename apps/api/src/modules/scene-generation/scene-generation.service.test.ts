import { AiProviderRegistry, MockAiProvider } from '@abi/ai-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ConsistencyValidationService } from '../consistency-validation/consistency-validation.service.js';
import { RecommendedActionDto } from '../consistency-validation/dto/consistency-validation.dto.js';
import type { GraphQueryService } from '../knowledge-graph/graph-query.service.js';
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
      new AiProviderRegistry([], []),
      { putObject: vi.fn() }
    );

    const response = await service.generate('project-1', {
      text: 'John talks near the fountain.',
      styleId: 'style-1'
    });

    expect(response.status).toBe(SceneGenerationStatusDto.MISSING_REFERENCES);
    expect(response.missingReferences).toHaveLength(2);
    expect(response.missingReferences.map((item) => item.versionId)).toEqual([
      'character-version-1',
      'location-version-1'
    ]);
    expect(sceneCreate).not.toHaveBeenCalled();
  });

  it('creates scene and generated asset when references are approved', async () => {
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
    const generationJobCreate = vi.fn().mockResolvedValue({ id: 'job-1' });
    const assetCreate = vi.fn().mockImplementation(({ data }: { readonly data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'scene-asset-1',
        projectId: data.projectId,
        sceneId: data.sceneId,
        jobId: data.jobId,
        type: data.type,
        approvalStatus: data.approvalStatus,
        localPath: data.localPath,
        mimeType: data.mimeType,
        width: null,
        height: null,
        prompt: data.prompt,
        seed: data.seed,
        model: data.model,
        provider: data.provider,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata,
        createdAt: now,
        updatedAt: now
      })
    );
    const prisma = {
      visualStyle: {
        findUnique: vi.fn().mockResolvedValue(createVisualStyle())
      },
      asset: {
        findMany: vi.fn().mockResolvedValue([
          createReferenceAsset('asset-character-1', 'CHARACTER_VERSION', 'character-version-1'),
          createReferenceAsset('asset-location-1', 'LOCATION_VERSION', 'location-version-1')
        ]),
        create: assetCreate
      },
      scene: {
        aggregate: vi.fn().mockResolvedValue({ _max: { orderIndex: null } }),
        create: sceneCreate,
        update: vi.fn().mockResolvedValue({})
      },
      generationJob: {
        create: generationJobCreate,
        update: vi.fn().mockResolvedValue({})
      }
    } as unknown as PrismaService;
    const graph = {
      findCharacterContext: vi.fn().mockResolvedValue({ nodes: [], relationships: [] }),
      findLocationContext: vi.fn().mockResolvedValue({ nodes: [], relationships: [] })
    } as unknown as GraphQueryService;
    const provider = new MockAiProvider({
      id: 'mock-image',
      imageResponses: [
        {
          providerId: 'mock-image',
          model: 'mock-model',
          images: [
            {
              b64Json: Buffer.from('fake-image').toString('base64'),
              mimeType: 'image/png'
            }
          ]
        }
      ]
    });
    const putObject = vi.fn().mockResolvedValue({
      key: 'scenes/project-1/scene-1/image.png',
      contentType: 'image/png'
    });
    const validateAsset = vi.fn().mockResolvedValue({
      passed: true,
      score: 0.87,
      checks: [],
      recommendedAction: RecommendedActionDto.APPROVE
    });
    const service = new SceneGenerationService(
      prisma,
      resolver,
      graph,
      new ScenePromptBuilderService(),
      new AiProviderRegistry([], [provider]),
      { putObject },
      { validateAsset } as unknown as ConsistencyValidationService
    );

    const response = await service.generate('project-1', {
      text: 'John talks near the fountain.',
      styleId: 'style-1',
      aspectRatio: '16:9'
    });

    expect(response.status).toBe(SceneGenerationStatusDto.GENERATED);
    expect(response.sceneId).toBe('scene-1');
    expect(response.assetId).toBe('scene-asset-1');
    expect(generationJobCreate).toHaveBeenCalled();
    expect(assetCreate).toHaveBeenCalled();
    expect(putObject).toHaveBeenCalled();
    expect(validateAsset).toHaveBeenCalledWith('scene-asset-1');
    expect(response.validationResult?.recommendedAction).toBe(RecommendedActionDto.APPROVE);
  });
});

function createResolution(): SceneEntityResolutionResult {
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
    objects: []
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
