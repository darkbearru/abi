import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Asset, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { ValidationResultDto } from './dto/consistency-validation.dto.js';
import {
  IMAGE_VALIDATION_PROVIDER,
  type ImageValidationEntity,
  type ImageValidationProvider,
  type ImageValidationReferenceAsset
} from './ports/image-validation.provider.js';

const ASSET_INCLUDE = {
  scene: {
    include: {
      character: {
        include: {
          aliases: true,
          versions: { orderBy: { version: 'asc' } }
        }
      },
      location: {
        include: {
          aliases: true,
          versions: { orderBy: { version: 'asc' } }
        }
      },
      visualStyle: true
    }
  }
} satisfies Prisma.AssetInclude;

type AssetWithScene = Prisma.AssetGetPayload<{
  include: typeof ASSET_INCLUDE;
}>;

@Injectable()
export class ConsistencyValidationService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(IMAGE_VALIDATION_PROVIDER)
    private readonly provider: ImageValidationProvider
  ) {}

  async validateAsset(assetId: string): Promise<ValidationResultDto> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      include: ASSET_INCLUDE
    });

    if (!asset) {
      throw new NotFoundException('Asset was not found.');
    }

    const referenceAssets = await this.getReferenceAssets(asset);
    const result = await this.provider.validateImage({
      assetId: asset.id,
      localPath: asset.localPath,
      mimeType: asset.mimeType,
      prompt: asset.prompt,
      userRequest: asset.scene?.description ?? null,
      styleName: asset.scene?.visualStyle?.name ?? null,
      stylePrompt: asset.scene?.visualStyle?.prompt ?? null,
      entities: buildEntities(asset),
      referenceAssets
    });

    await this.prisma.asset.update({
      where: { id: asset.id },
      data: {
        metadata: toInputJsonObject({
          ...toRecord(asset.metadata),
          consistencyValidation: result
        })
      }
    });

    return result;
  }

  private async getReferenceAssets(
    asset: AssetWithScene
  ): Promise<readonly ImageValidationReferenceAsset[]> {
    const metadata = toRecord(asset.metadata);
    const referenceAssetIds = getStringArray(metadata.referenceAssetIds);

    if (referenceAssetIds.length === 0) {
      return [];
    }

    const assets = await this.prisma.asset.findMany({
      where: {
        id: { in: [...referenceAssetIds] },
        type: 'REFERENCE',
        approvalStatus: 'APPROVED'
      },
      orderBy: { createdAt: 'asc' }
    });

    return assets.map(toReferenceAsset);
  }
}

function buildEntities(asset: AssetWithScene): readonly ImageValidationEntity[] {
  const entities: ImageValidationEntity[] = [];

  if (asset.scene?.character) {
    const latestVersion = asset.scene.character.versions.at(-1);

    entities.push({
      type: 'character',
      id: asset.scene.character.id,
      name: asset.scene.character.canonicalName,
      description: latestVersion
        ? [
            latestVersion.age ? `age=${latestVersion.age}` : undefined,
            `appearance=${stringifyJson(latestVersion.appearance)}`,
            latestVersion.clothing ? `clothing=${stringifyJson(latestVersion.clothing)}` : undefined,
            latestVersion.visualPrompt ? `visual=${latestVersion.visualPrompt}` : undefined
          ]
            .filter((part): part is string => Boolean(part))
            .join('; ')
        : null
    });
  }

  if (asset.scene?.location) {
    const latestVersion = asset.scene.location.versions.at(-1);

    entities.push({
      type: 'location',
      id: asset.scene.location.id,
      name: asset.scene.location.name,
      description: latestVersion
        ? [
            `description=${latestVersion.description}`,
            latestVersion.atmosphere ? `atmosphere=${stringifyJson(latestVersion.atmosphere)}` : undefined,
            latestVersion.palette ? `palette=${stringifyJson(latestVersion.palette)}` : undefined,
            latestVersion.era ? `era=${latestVersion.era}` : undefined
          ]
            .filter((part): part is string => Boolean(part))
            .join('; ')
        : null
    });
  }

  if (asset.scene?.visualStyle) {
    entities.push({
      type: 'style',
      id: asset.scene.visualStyle.id,
      name: asset.scene.visualStyle.name,
      description: asset.scene.visualStyle.prompt
    });
  }

  if (asset.scene?.description) {
    entities.push({
      type: 'user_request',
      id: asset.scene.id,
      name: 'User request',
      description: asset.scene.description
    });
  }

  return entities;
}

function toReferenceAsset(asset: Asset): ImageValidationReferenceAsset {
  return {
    id: asset.id,
    entityType: asset.entityType ?? 'UNKNOWN',
    entityId: asset.entityId ?? '',
    localPath: asset.localPath,
    prompt: asset.prompt
  };
}

function stringifyJson(value: Prisma.JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function getStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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
