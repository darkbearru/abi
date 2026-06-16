import { AiProviderRegistry, MockAiProvider } from '@abi/ai-core';
import type { StorageService } from '@abi/storage';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { CharacterVisualPassportService } from './character-visual-passport.service.js';
import { CharacterVisualPassportAssetTypeDto } from './dto/character-visual-passport.dto.js';
import { PromptBuilderService } from './prompt-builder.service.js';

interface AssetCreatePayload {
  readonly data: {
    readonly projectId?: string;
    readonly jobId: string;
    readonly type: 'GENERATED' | 'REFERENCE';
    readonly approvalStatus: 'DRAFT' | 'APPROVED' | 'REJECTED';
    readonly localPath: string;
    readonly mimeType: string;
    readonly prompt: string;
    readonly seed: number;
    readonly model?: string;
    readonly provider: string;
    readonly entityType: 'CHARACTER_VERSION';
    readonly entityId: string;
    readonly metadata: Record<string, unknown>;
  };
}

interface GenerationJobCreatePayload {
  readonly data: {
    readonly projectId?: string;
    readonly userId: string;
    readonly visualStyleId: string;
    readonly status: string;
    readonly progress: number;
    readonly input: Record<string, unknown>;
  };
}

interface GenerationJobUpdatePayload {
  readonly where: {
    readonly id: string;
  };
  readonly data: {
    readonly status?: string;
    readonly progress?: number;
    readonly output?: Record<string, unknown>;
    readonly error?: Record<string, unknown>;
  };
}

describe('CharacterVisualPassportService', () => {
  it('creates a generation job and draft passport asset', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const generationJobCreate = vi
      .fn<(payload: GenerationJobCreatePayload) => Promise<{ readonly id: string }>>()
      .mockResolvedValue({ id: 'job-1' });
    const generationJobUpdate = vi
      .fn<(payload: GenerationJobUpdatePayload) => Promise<Record<string, never>>>()
      .mockResolvedValue({});
    const assetCreate = vi
      .fn<(payload: AssetCreatePayload) => Promise<Record<string, unknown>>>()
      .mockImplementation(({ data }) =>
        Promise.resolve({
        id: 'asset-1',
        projectId: data.projectId,
        sceneId: null,
        jobId: data.jobId,
        type: data.type,
        approvalStatus: data.approvalStatus,
        localPath: data.localPath,
        mimeType: data.mimeType,
        width: null,
        height: null,
        prompt: data.prompt,
        seed: data.seed,
        model: data.model ?? null,
        provider: data.provider,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata,
        createdAt: now,
        updatedAt: now
        })
      );
    const prisma = {
      characterVersion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'character-version-1',
          characterId: 'character-1',
          version: 1,
          age: 'adult',
          timelineRange: { phase: 'main' },
          appearance: { hair: 'black' },
          personality: { traits: ['focused'] },
          speechManner: 'quiet',
          clothing: { coat: 'blue coat' },
          visualPrompt: 'sharp eyes',
          negativePrompt: 'wrong costume',
          confidenceScore: 0.9,
          sourceFactIds: ['fact-1'],
          createdAt: now,
          character: {
            id: 'character-1',
            canonicalName: 'Mara',
            worldBible: {
              id: 'world-bible-1',
              projectId: 'project-1',
              project: { userId: 'user-1' },
              series: null
            }
          }
        })
      },
      visualStyle: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'visual-style-1',
          slug: 'graphic-novel',
          name: 'Graphic Novel',
          description: null,
          prompt: 'bold ink silhouettes',
          negativePrompt: 'soft watercolor',
          primaryColor: '#111111',
          secondaryColor: '#eeeeee',
          accentColor: '#cc3333',
          contrastLevel: 80,
          saturationLevel: 45,
          grainLevel: 20,
          lineThickness: 70,
          isDefault: false,
          createdAt: now,
          updatedAt: now
        })
      },
      generationJob: {
        create: generationJobCreate,
        update: generationJobUpdate
      },
      asset: {
        create: assetCreate
      }
    } as unknown as PrismaService;
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
      key: 'character-passports/character-version-1/front_view.png',
      contentType: 'image/png'
    });
    const storage = {
      putObject
    } as unknown as StorageService;
    const service = new CharacterVisualPassportService(
      prisma,
      new PromptBuilderService(),
      new AiProviderRegistry([], [provider]),
      storage
    );

    const response = await service.generate('character-version-1', {
      visualStyleId: 'visual-style-1',
      providerId: 'mock-image',
      model: 'mock-model',
      assetTypes: [CharacterVisualPassportAssetTypeDto.FRONT_VIEW]
    });

    const createdJobPayload = generationJobCreate.mock.calls[0]?.[0];
    const createdAssetPayload = assetCreate.mock.calls[0]?.[0];
    const finalJobUpdatePayload = generationJobUpdate.mock.calls.at(-1)?.[0];

    expect(createdJobPayload?.data.projectId).toBe('project-1');
    expect(createdJobPayload?.data.userId).toBe('user-1');
    expect(createdJobPayload?.data.visualStyleId).toBe('visual-style-1');
    expect(createdJobPayload?.data.status).toBe('PROCESSING');
    expect(createdAssetPayload?.data.jobId).toBe('job-1');
    expect(createdAssetPayload?.data.type).toBe('GENERATED');
    expect(createdAssetPayload?.data.approvalStatus).toBe('DRAFT');
    expect(createdAssetPayload?.data.provider).toBe('mock-image');
    expect(createdAssetPayload?.data.model).toBe('mock-model');
    expect(createdAssetPayload?.data.entityType).toBe('CHARACTER_VERSION');
    expect(createdAssetPayload?.data.entityId).toBe('character-version-1');
    expect(putObject).toHaveBeenCalled();
    expect(response.generationJobId).toBe('job-1');
    expect(response.assets[0]?.approvalStatus).toBe('draft');
    expect(finalJobUpdatePayload?.where.id).toBe('job-1');
    expect(finalJobUpdatePayload?.data.status).toBe('COMPLETED');
    expect(finalJobUpdatePayload?.data.progress).toBe(100);
  });
});
