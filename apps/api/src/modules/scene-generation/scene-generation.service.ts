import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Asset, Prisma, Scene } from '@prisma/client';

import { GraphQueryService } from '../knowledge-graph/graph-query.service.js';
import { QueueService } from '../queue/queue.service.js';
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
    @Inject(QueueService)
    private readonly queue: QueueService
  ) {}

  async generate(
    projectId: string,
    dto: GenerateSceneDto,
    userId: string
  ): Promise<SceneGenerationResponseDto> {
    const resolution = await this.resolver.resolve(projectId, dto.text, dto.timelineHint);
    const hasResolvedEntities =
      resolution.characters.length > 0 ||
      resolution.locations.length > 0 ||
      resolution.objects.length > 0;

    if (resolution.candidates.length > 0 || (!hasResolvedEntities && resolution.createSuggestions.length > 0)) {
      return {
        status: SceneGenerationStatusDto.NEEDS_RESOLUTION,
        candidates: resolution.candidates,
        createSuggestions: resolution.createSuggestions,
        missingReferences: [],
        referenceAssets: []
      };
    }

    const [visualStyle, referenceResult, graphContext] = await Promise.all([
      this.resolveVisualStyle(projectId, dto.styleId),
      this.getReferenceAssets(resolution),
      this.getGraphContext(projectId, resolution)
    ]);

    if (referenceResult.missingReferences.length > 0) {
      return {
        status: SceneGenerationStatusDto.MISSING_REFERENCES,
        candidates: [],
        createSuggestions: resolution.createSuggestions,
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
    const scene = await this.createScene(projectId, dto, builtPrompt.prompt, visualStyle.id, resolution);
    const providerId = process.env.SCENE_IMAGE_PROVIDER ?? 'openai';
    const model = process.env.SCENE_IMAGE_MODEL;
    const size = process.env.SCENE_IMAGE_SIZE ?? '1024x1024';

    const job = await this.queue.createJob({
      queueName: 'image-generation',
      name: 'generate-scene',
      projectId,
      userId,
      sceneId: scene.id,
      visualStyleId: visualStyle.id,
      payload: {
        sceneId: scene.id,
        projectId,
        userId,
        prompt: builtPrompt.prompt,
        visualStyleId: visualStyle.id,
        text: dto.text,
        ...(dto.timelineHint === undefined ? {} : { timelineHint: dto.timelineHint }),
        aspectRatio,
        providerId,
        ...(model === undefined ? {} : { model }),
        size,
        negativePrompt: builtPrompt.negativePrompt,
        characterIds: resolution.characters.map((character) => character.id),
        characterVersionIds: resolution.characters.map((character) => character.version.id),
        locationIds: resolution.locations.map((location) => location.id),
        locationVersionIds: resolution.locations.map((location) => location.version.id),
        objectIds: resolution.objects.map((object) => object.id),
        referenceAssetIds: referenceResult.assets.map((asset) => asset.id)
      }
    });

    return {
      status: SceneGenerationStatusDto.QUEUED,
      sceneId: scene.id,
      generationJobId: job.id,
      prompt: builtPrompt.prompt,
      candidates: [],
      createSuggestions: resolution.createSuggestions,
      missingReferences: [],
      referenceAssets: referenceResult.assets.map(toReferenceAssetDto)
    };
  }

  private async resolveVisualStyle(
    projectId: string,
    explicitStyleId: string | undefined
  ): Promise<Prisma.VisualStyleGetPayload<object>> {
    if (explicitStyleId) {
      return this.getVisualStyle(explicitStyleId);
    }

    const project = await this.prisma.userBookProject.findUnique({
      where: { id: projectId },
      select: { visualStyleId: true }
    });

    if (!project) {
      throw new NotFoundException('Project was not found.');
    }

    if (project.visualStyleId) {
      return this.getVisualStyle(project.visualStyleId);
    }

    const fallbackStyle = await this.prisma.visualStyle.findFirst({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
    });

    if (!fallbackStyle) {
      throw new NotFoundException('Visual style was not found.');
    }

    return fallbackStyle;
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
    visualStyleId: string,
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
        visualStyleId,
        ...(resolution.characters[0] ? { characterId: resolution.characters[0].id } : {}),
        ...(resolution.locations[0] ? { locationId: resolution.locations[0].id } : {})
      }
    });
  }
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
