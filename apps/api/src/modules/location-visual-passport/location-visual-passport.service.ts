import { randomInt } from 'node:crypto';

import { AiProviderRegistry } from '@abi/ai-core';
import { StorageService } from '@abi/storage';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Asset, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  LocationAssetApprovalStatusDto,
  LocationVisualPassportAssetTypeDto,
  type GenerateLocationVisualPassportDto,
  type LocationVisualPassportAssetResponseDto,
  type LocationVisualPassportResponseDto
} from './dto/location-visual-passport.dto.js';
import {
  type LocationParentContext,
  LocationPromptBuilderService
} from './location-prompt-builder.service.js';

const DEFAULT_ASSET_TYPES = [
  LocationVisualPassportAssetTypeDto.OVERVIEW,
  LocationVisualPassportAssetTypeDto.MAP,
  LocationVisualPassportAssetTypeDto.MAIN_ANGLE,
  LocationVisualPassportAssetTypeDto.SECONDARY_ANGLE,
  LocationVisualPassportAssetTypeDto.OBJECT_DETAIL,
  LocationVisualPassportAssetTypeDto.PALETTE_BOARD
] as const;

const LOCATION_VERSION_INCLUDE = {
  location: {
    include: {
      worldBible: {
        include: {
          project: { select: { userId: true } },
          series: { select: { userId: true } }
        }
      }
    }
  }
} satisfies Prisma.LocationVersionInclude;

const LOCATION_WITH_VERSIONS_INCLUDE = {
  versions: true
} satisfies Prisma.LocationInclude;

type LocationVersionWithLocation = Prisma.LocationVersionGetPayload<{
  include: typeof LOCATION_VERSION_INCLUDE;
}>;

type LocationWithVersions = Prisma.LocationGetPayload<{
  include: typeof LOCATION_WITH_VERSIONS_INCLUDE;
}>;

@Injectable()
export class LocationVisualPassportService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(LocationPromptBuilderService)
    private readonly prompts: LocationPromptBuilderService,
    @Inject(AiProviderRegistry)
    private readonly aiProviders: AiProviderRegistry,
    @Inject(StorageService)
    private readonly storage: StorageService
  ) {}

  async generate(
    locationVersionId: string,
    dto: GenerateLocationVisualPassportDto
  ): Promise<LocationVisualPassportResponseDto> {
    const [locationVersion, visualStyle] = await Promise.all([
      this.getLocationVersion(locationVersionId),
      this.getVisualStyle(dto.visualStyleId)
    ]);
    const parentLocations = await this.getParentLocations(locationVersion.location);
    const assetTypes = dto.assetTypes && dto.assetTypes.length > 0 ? dto.assetTypes : DEFAULT_ASSET_TYPES;
    const providerId = dto.providerId ?? process.env.LOCATION_PASSPORT_IMAGE_PROVIDER ?? 'openai';
    const model = dto.model ?? process.env.LOCATION_PASSPORT_IMAGE_MODEL;
    const size = dto.size ?? process.env.LOCATION_PASSPORT_IMAGE_SIZE ?? '1024x1024';
    const projectId = locationVersion.location.worldBible.projectId;
    const userId = requireWorldBibleUserId(locationVersion.location.worldBible);
    const job = await this.prisma.generationJob.create({
      data: {
        ...(projectId === null ? {} : { projectId }),
        userId,
        visualStyleId: visualStyle.id,
        status: 'PROCESSING',
        progress: 0,
        input: toInputJsonObject({
          type: 'location_visual_passport',
          locationVersionId,
          visualStyleId: visualStyle.id,
          locationId: locationVersion.locationId,
          parentLocationIds: parentLocations.map((location) => location.id),
          assetTypes: [...assetTypes],
          providerId,
          ...(model === undefined ? {} : { model }),
          size
        })
      },
      select: { id: true }
    });

    try {
      const assets: Asset[] = [];

      for (const [index, assetType] of assetTypes.entries()) {
        const seed = createSeed(locationVersionId, assetType);
        const builtPrompt = this.prompts.buildLocationVisualPassportPrompt({
          locationName: locationVersion.location.name,
          parentLocations,
          locationVersion,
          visualStyle,
          assetType,
          seed
        });
        const response = await this.aiProviders.generateImage(providerId, {
          prompt: builtPrompt.prompt,
          ...(model === undefined ? {} : { model }),
          size,
          count: 1,
          metadata: {
            generationJobId: job.id,
            purpose: 'location-visual-passport',
            tags: ['location-version', assetType]
          }
        });
        const image = response.images[0];

        if (!image) {
          throw new Error(`Image provider "${providerId}" returned no images.`);
        }

        const imageBytes = await readGeneratedImageBytes(image);
        const mimeType = image.mimeType ?? 'image/png';
        const stored = await this.storage.putObject({
          key: buildStorageKey(locationVersionId, assetType, seed, mimeType),
          body: imageBytes,
          contentType: mimeType
        });
        const asset = await this.prisma.asset.create({
          data: {
            ...(projectId === null ? {} : { projectId }),
            jobId: job.id,
            type: 'GENERATED',
            approvalStatus: 'DRAFT',
            localPath: stored.key,
            mimeType,
            prompt: builtPrompt.prompt,
            seed,
            ...(response.model === undefined ? {} : { model: response.model }),
            provider: response.providerId,
            entityType: 'LOCATION_VERSION',
            entityId: locationVersion.id,
            metadata: toInputJsonObject({
              passportAssetType: assetType,
              negativePrompt: builtPrompt.negativePrompt,
              visualStyleId: visualStyle.id,
              locationId: locationVersion.locationId,
              parentLocationIds: parentLocations.map((location) => location.id),
              orderIndex: index
            })
          }
        });

        assets.push(asset);

        await this.prisma.generationJob.update({
          where: { id: job.id },
          data: {
            progress: Math.round(((index + 1) / assetTypes.length) * 100)
          }
        });
      }

      await this.prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          output: toInputJsonObject({
            assetIds: assets.map((asset) => asset.id)
          })
        }
      });

      return {
        generationJobId: job.id,
        assets: assets.map(toAssetResponseDto)
      };
    } catch (error) {
      await this.prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: toInputJsonObject({
            message: error instanceof Error ? error.message : 'Unknown image generation error.'
          })
        }
      });

      throw error;
    }
  }

  async updateApproval(
    assetId: string,
    approvalStatus: LocationAssetApprovalStatusDto
  ): Promise<LocationVisualPassportAssetResponseDto> {
    const existing = await this.prisma.asset.findUnique({ where: { id: assetId } });

    if (!existing || existing.entityType !== 'LOCATION_VERSION') {
      throw new NotFoundException('Location passport asset was not found.');
    }

    const asset = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        approvalStatus: toPrismaApprovalStatus(approvalStatus),
        type: approvalStatus === LocationAssetApprovalStatusDto.APPROVED ? 'REFERENCE' : 'GENERATED'
      }
    });

    return toAssetResponseDto(asset);
  }

  private async getLocationVersion(id: string): Promise<LocationVersionWithLocation> {
    const locationVersion = await this.prisma.locationVersion.findUnique({
      where: { id },
      include: LOCATION_VERSION_INCLUDE
    });

    if (!locationVersion) {
      throw new NotFoundException('Location version was not found.');
    }

    return locationVersion;
  }

  private async getVisualStyle(id: string): Promise<Prisma.VisualStyleGetPayload<object>> {
    const visualStyle = await this.prisma.visualStyle.findUnique({ where: { id } });

    if (!visualStyle) {
      throw new NotFoundException('Visual style was not found.');
    }

    return visualStyle;
  }

  private async getParentLocations(location: LocationVersionWithLocation['location']): Promise<LocationParentContext[]> {
    const locations = await this.prisma.location.findMany({
      where: { worldBibleId: location.worldBibleId },
      include: LOCATION_WITH_VERSIONS_INCLUDE
    });
    const locationsById = new Map(locations.map((candidate) => [candidate.id, candidate]));
    const chain: LocationWithVersions[] = [];
    const visited = new Set<string>();
    let parentId = location.parentId;

    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);

      const parent = locationsById.get(parentId);

      if (!parent) {
        break;
      }

      chain.unshift(parent);
      parentId = parent.parentId;
    }

    return chain.map(toParentContext);
  }
}

function toParentContext(location: LocationWithVersions): LocationParentContext {
  const latestVersion = [...location.versions].sort((left, right) => right.version - left.version)[0];

  return {
    id: location.id,
    name: location.name,
    description: latestVersion?.description ?? null,
    atmosphere: latestVersion?.atmosphere ?? null,
    palette: latestVersion?.palette ?? null,
    era: latestVersion?.era ?? null,
    architectureRules: latestVersion?.architectureRules ?? null
  };
}

function createSeed(
  locationVersionId: string,
  assetType: LocationVisualPassportAssetTypeDto
): number {
  const base = Array.from(`${locationVersionId}:${assetType}`).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0
  );

  return (base + randomInt(1, 1_000_000_000)) % 1_000_000_000;
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

function buildStorageKey(
  locationVersionId: string,
  assetType: LocationVisualPassportAssetTypeDto,
  seed: number,
  mimeType: string
): string {
  const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';

  return [
    'location-passports',
    locationVersionId,
    `${assetType}-${String(seed)}.${extension}`
  ].join('/');
}

function toAssetResponseDto(asset: Asset): LocationVisualPassportAssetResponseDto {
  const metadata = toRecord(asset.metadata);

  return {
    id: asset.id,
    passportAssetType: toPassportAssetType(metadata.passportAssetType),
    approvalStatus: toDtoApprovalStatus(asset.approvalStatus),
    localPath: asset.localPath,
    mimeType: asset.mimeType,
    prompt: asset.prompt ?? '',
    negativePrompt:
      typeof metadata.negativePrompt === 'string' ? metadata.negativePrompt : null,
    seed: asset.seed,
    provider: asset.provider,
    model: asset.model
  };
}

function toPassportAssetType(value: unknown): LocationVisualPassportAssetTypeDto {
  return Object.values(LocationVisualPassportAssetTypeDto).includes(
    value as LocationVisualPassportAssetTypeDto
  )
    ? (value as LocationVisualPassportAssetTypeDto)
    : LocationVisualPassportAssetTypeDto.OVERVIEW;
}

function toPrismaApprovalStatus(status: LocationAssetApprovalStatusDto): 'DRAFT' | 'APPROVED' | 'REJECTED' {
  switch (status) {
    case LocationAssetApprovalStatusDto.APPROVED:
      return 'APPROVED';
    case LocationAssetApprovalStatusDto.REJECTED:
      return 'REJECTED';
    case LocationAssetApprovalStatusDto.DRAFT:
      return 'DRAFT';
  }
}

function toDtoApprovalStatus(status: string): LocationAssetApprovalStatusDto {
  switch (status) {
    case 'APPROVED':
      return LocationAssetApprovalStatusDto.APPROVED;
    case 'REJECTED':
      return LocationAssetApprovalStatusDto.REJECTED;
    default:
      return LocationAssetApprovalStatusDto.DRAFT;
  }
}

function toInputJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Prisma.InputJsonValue] =>
      isInputJsonValue(entry[1])
    )
  );
}

function requireWorldBibleUserId(
  worldBible: LocationVersionWithLocation['location']['worldBible']
): string {
  const userId = worldBible.project?.userId ?? worldBible.series?.userId;

  if (!userId) {
    throw new Error('World bible does not have a project or series owner.');
  }

  return userId;
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

function toRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
