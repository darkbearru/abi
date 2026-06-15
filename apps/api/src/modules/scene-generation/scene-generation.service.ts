import { randomInt } from 'node:crypto';

import { AiProviderRegistry } from '@abi/ai-core';
import { StorageService } from '@abi/storage';
import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { Asset, Prisma, Scene } from '@prisma/client';

import { ConsistencyValidationService } from '../consistency-validation/consistency-validation.service.js';
import { GraphQueryService } from '../knowledge-graph/graph-query.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  SceneGenerationStatusDto,
  type GenerateSceneDto,
  type SceneGenerationResponseDto,
  type SceneMissingReferenceDto,
  type SceneReferenceAssetDto
} from './dto/scene-generation.dto.js';
import {
  SceneEntityResolutionService,
  type SceneEntityResolutionResult
} from './scene-entity-resolution.service.js';
import {
  ScenePromptBuilderService,
  type ScenePromptReferenceAsset
} from './scene-prompt-builder.service.js';

type ReferenceEntityType = 'CHARACTER_VERSION' | 'LOCATION_VERSION' | 'WORLD_OBJECT';

interface ReferenceEntity {
  readonly entityType: ReferenceEntityType;
  readonly entityId: string;
}

interface RequiredReferenceEntity extends ReferenceEntity {
  readonly parentEntityId: string;
  readonly name: string;
}

@Injectable()
export class SceneGenerationService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SceneEntityResolutionService)
    private readonly resolver: SceneEntityResolutionService,
    @Inject(GraphQueryService)
    private readonly graph: GraphQueryService,
    @Inject(ScenePromptBuilderService)
    private readonly prompts: ScenePromptBuilderService,
    @Inject(AiProviderRegistry)
    private readonly aiProviders: AiProviderRegistry,
    @Inject(StorageService)
    private readonly storage: StorageService,
    @Optional()
    @Inject(ConsistencyValidationService)
    private readonly consistencyValidation?: ConsistencyValidationService
  ) {}

  async generate(projectId: string, dto: GenerateSceneDto): Promise<SceneGenerationResponseDto> {
    const resolution = await this.resolver.resolve(projectId, dto.text, dto.timelineHint);

    if (resolution.candidates.length > 0 || resolution.createSuggestions.length > 0) {
      return {
        status: SceneGenerationStatusDto.NEEDS_RESOLUTION,
        candidates: resolution.candidates,
        createSuggestions: resolution.createSuggestions,
        missingReferences: [],
        referenceAssets: []
      };
    }

    const [visualStyle, referenceResult, graphContext] = await Promise.all([
      this.getVisualStyle(dto.styleId),
      this.getReferenceAssets(resolution),
      this.getGraphContext(projectId, resolution)
    ]);

    if (referenceResult.missingReferences.length > 0) {
      return {
        status: SceneGenerationStatusDto.MISSING_REFERENCES,
        candidates: [],
        createSuggestions: [],
        missingReferences: referenceResult.missingReferences,
        referenceAssets: referenceResult.assets.map(toReferenceAssetDto)
      };
    }

    const aspectRatio = dto.aspectRatio ?? '1:1';
    const builtPrompt = this.prompts.buildScenePrompt({
      userText: dto.text,
      ...(dto.timelineHint === undefined ? {} : { timelineHint: dto.timelineHint }),
      aspectRatio,
      characters: resolution.characters,
      locations: resolution.locations,
      objects: resolution.objects,
      visualStyle,
      graphContext,
      referenceAssets: referenceResult.assets
    });
    const scene = await this.createScene(projectId, dto, builtPrompt.prompt, resolution);
    const providerId = process.env.SCENE_IMAGE_PROVIDER ?? 'openai';
    const model = process.env.SCENE_IMAGE_MODEL;
    const size = process.env.SCENE_IMAGE_SIZE ?? '1024x1024';
    const job = await this.prisma.generationJob.create({
      data: {
        projectId,
        sceneId: scene.id,
        visualStyleId: visualStyle.id,
        status: 'PROCESSING',
        progress: 0,
        input: toInputJsonObject({
          type: 'scene_generation',
          text: dto.text,
          styleId: dto.styleId,
          ...(dto.timelineHint === undefined ? {} : { timelineHint: dto.timelineHint }),
          aspectRatio,
          providerId,
          ...(model === undefined ? {} : { model }),
          size,
          characterIds: resolution.characters.map((character) => character.id),
          characterVersionIds: resolution.characters.map((character) => character.version.id),
          locationIds: resolution.locations.map((location) => location.id),
          locationVersionIds: resolution.locations.map((location) => location.version.id),
          objectIds: resolution.objects.map((object) => object.id),
          referenceAssetIds: referenceResult.assets.map((asset) => asset.id)
        })
      },
      select: { id: true }
    });

    try {
      const response = await this.aiProviders.generateImage(providerId, {
        prompt: builtPrompt.prompt,
        ...(model === undefined ? {} : { model }),
        size,
        count: 1,
        metadata: {
          generationJobId: job.id,
          purpose: 'scene-generation',
          tags: ['scene', projectId]
        }
      });
      const image = response.images[0];

      if (!image) {
        throw new Error(`Image provider "${providerId}" returned no images.`);
      }

      const seed = createSeed(scene.id);
      const imageBytes = await readGeneratedImageBytes(image);
      const mimeType = image.mimeType ?? 'image/png';
      const stored = await this.storage.putObject({
        key: buildStorageKey(projectId, scene.id, seed, mimeType),
        body: imageBytes,
        contentType: mimeType
      });
      const asset = await this.prisma.asset.create({
        data: {
          projectId,
          sceneId: scene.id,
          jobId: job.id,
          type: 'GENERATED',
          approvalStatus: 'DRAFT',
          localPath: stored.key,
          mimeType,
          prompt: builtPrompt.prompt,
          seed,
          ...(response.model === undefined ? {} : { model: response.model }),
          provider: response.providerId,
          entityType: 'SCENE',
          entityId: scene.id,
          metadata: toInputJsonObject({
            negativePrompt: builtPrompt.negativePrompt,
            aspectRatio,
            styleId: visualStyle.id,
            referenceAssetIds: referenceResult.assets.map((referenceAsset) => referenceAsset.id)
          })
        }
      });
      const validationResult = await this.consistencyValidation?.validateAsset(asset.id);

      await Promise.all([
        this.prisma.scene.update({
          where: { id: scene.id },
          data: { status: 'COMPLETED' }
        }),
        this.prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            progress: 100,
            output: toInputJsonObject({ assetId: asset.id, localPath: asset.localPath })
          }
        })
      ]);

      return {
        status: SceneGenerationStatusDto.GENERATED,
        sceneId: scene.id,
        generationJobId: job.id,
        assetId: asset.id,
        localPath: asset.localPath,
        prompt: builtPrompt.prompt,
        ...(validationResult === undefined ? {} : { validationResult }),
        candidates: [],
        createSuggestions: [],
        missingReferences: [],
        referenceAssets: referenceResult.assets.map(toReferenceAssetDto)
      };
    } catch (error) {
      await Promise.all([
        this.prisma.scene.update({
          where: { id: scene.id },
          data: { status: 'FAILED' }
        }),
        this.prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: toInputJsonObject({
              message: error instanceof Error ? error.message : 'Unknown scene generation error.'
            })
          }
        })
      ]);

      throw error;
    }
  }

  private async getVisualStyle(id: string): Promise<Prisma.VisualStyleGetPayload<object>> {
    const visualStyle = await this.prisma.visualStyle.findUnique({ where: { id } });

    if (!visualStyle) {
      throw new NotFoundException('Visual style was not found.');
    }

    return visualStyle;
  }

  private async getReferenceAssets(
    resolution: SceneEntityResolutionResult
  ): Promise<{
    readonly assets: readonly ScenePromptReferenceAsset[];
    readonly missingReferences: readonly SceneMissingReferenceDto[];
  }> {
    const required: readonly RequiredReferenceEntity[] = [
      ...resolution.characters.map((character) => ({
        entityType: 'CHARACTER_VERSION' as const,
        entityId: character.version.id,
        parentEntityId: character.id,
        name: character.name
      })),
      ...resolution.locations.map((location) => ({
        entityType: 'LOCATION_VERSION' as const,
        entityId: location.version.id,
        parentEntityId: location.id,
        name: location.name
      }))
    ];
    const optional: readonly ReferenceEntity[] = resolution.objects.map((object) => ({
      entityType: 'WORLD_OBJECT' as const,
      entityId: object.id
    }));
    const whereEntities: Prisma.AssetWhereInput[] = [...required, ...optional].map((entity) => ({
      entityType: entity.entityType,
      entityId: entity.entityId
    }));
    const assets =
      whereEntities.length === 0
        ? []
        : await this.prisma.asset.findMany({
            where: {
              type: 'REFERENCE',
              approvalStatus: 'APPROVED',
              OR: whereEntities
            },
            orderBy: { createdAt: 'asc' }
          });
    const assetsByEntity = groupBy(assets, (asset) => `${asset.entityType ?? ''}:${asset.entityId ?? ''}`);
    const missingReferences = required
      .filter((entity) => !assetsByEntity.has(`${entity.entityType}:${entity.entityId}`))
      .map((entity) => ({
        entityType: entity.entityType,
        entityId: entity.parentEntityId,
        versionId: entity.entityId,
        name: entity.name,
        reason: 'Approved visual passport reference asset is required before scene generation.'
      }));

    return {
      assets: assets.map(toPromptReferenceAsset),
      missingReferences
    };
  }

  private async getGraphContext(
    projectId: string,
    resolution: SceneEntityResolutionResult
  ): Promise<{
    readonly nodes: readonly {
      readonly id: string;
      readonly labels: readonly string[];
      readonly properties: Record<string, unknown>;
    }[];
    readonly relationships: readonly {
      readonly id: string;
      readonly type: string;
      readonly source: string;
      readonly target: string;
      readonly properties: Record<string, unknown>;
    }[];
  }> {
    const contexts = await Promise.all([
      ...resolution.characters.map((character) =>
        this.graph.findCharacterContext(projectId, character.id)
      ),
      ...resolution.locations.map((location) =>
        this.graph.findLocationContext(projectId, location.id)
      )
    ]);

    return {
      nodes: uniqueBy(
        contexts.flatMap((context) => context.nodes),
        (node) => node.id
      ),
      relationships: uniqueBy(
        contexts.flatMap((context) => context.relationships),
        (relationship) => relationship.id
      )
    };
  }

  private async createScene(
    projectId: string,
    dto: GenerateSceneDto,
    prompt: string,
    resolution: SceneEntityResolutionResult
  ): Promise<Scene> {
    const aggregate = await this.prisma.scene.aggregate({
      where: { projectId },
      _max: { orderIndex: true }
    });

    return this.prisma.scene.create({
      data: {
        projectId,
        title: createSceneTitle(dto.text),
        description: dto.text,
        status: 'GENERATING',
        orderIndex: (aggregate._max.orderIndex ?? -1) + 1,
        prompt,
        visualStyleId: dto.styleId,
        ...(resolution.characters[0] ? { characterId: resolution.characters[0].id } : {}),
        ...(resolution.locations[0] ? { locationId: resolution.locations[0].id } : {})
      }
    });
  }
}

async function readGeneratedImageBytes(image: {
  readonly b64Json?: string;
  readonly url?: string;
}): Promise<Uint8Array> {
  if (image.b64Json) {
    return Uint8Array.from(Buffer.from(stripDataUrlPrefix(image.b64Json), 'base64'));
  }

  if (image.url) {
    const response = await fetch(image.url);

    if (!response.ok) {
      throw new Error(`Unable to fetch generated image URL: ${String(response.status)}.`);
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  throw new Error('Generated image did not contain b64Json or url.');
}

function stripDataUrlPrefix(value: string): string {
  return value.replace(/^data:[^;]+;base64,/, '');
}

function createSeed(sceneId: string): number {
  const base = Array.from(sceneId).reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return (base + randomInt(1, 1_000_000_000)) % 1_000_000_000;
}

function buildStorageKey(
  projectId: string,
  sceneId: string,
  seed: number,
  mimeType: string
): string {
  const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';

  return ['scenes', projectId, sceneId, `${String(seed)}.${extension}`].join('/');
}

function createSceneTitle(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function toPromptReferenceAsset(asset: Asset): ScenePromptReferenceAsset {
  return {
    id: asset.id,
    entityType: asset.entityType ?? 'UNKNOWN',
    entityId: asset.entityId ?? '',
    localPath: asset.localPath,
    mimeType: asset.mimeType,
    prompt: asset.prompt
  };
}

function toReferenceAssetDto(asset: ScenePromptReferenceAsset): SceneReferenceAssetDto {
  return {
    id: asset.id,
    entityType: asset.entityType,
    entityId: asset.entityId,
    localPath: asset.localPath,
    mimeType: asset.mimeType
  };
}

function groupBy<T>(
  values: readonly T[],
  getKey: (value: T) => string
): Map<string, readonly T[]> {
  const map = new Map<string, T[]>();

  for (const value of values) {
    const key = getKey(value);
    const existing = map.get(key) ?? [];

    existing.push(value);
    map.set(key, existing);
  }

  return map;
}

function uniqueBy<T>(values: readonly T[], getKey: (value: T) => string): readonly T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = getKey(value);

    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}

function toInputJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Prisma.InputJsonValue] =>
      isInputJsonValue(entry[1])
    )
  );
}

function isInputJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isInputJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).every(isInputJsonValue);
  }

  return false;
}
