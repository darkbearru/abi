import { randomInt } from 'node:crypto';

import { AiProviderRegistry } from '@abi/ai-core';
import { StorageService } from '@abi/storage';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Asset, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AssetApprovalStatusDto,
  CharacterVisualPassportAssetTypeDto,
  type CharacterVisualPassportAssetResponseDto,
  type CharacterVisualPassportResponseDto,
  type GenerateCharacterVisualPassportDto
} from './dto/character-visual-passport.dto.js';
import { PromptBuilderService } from './prompt-builder.service.js';

const DEFAULT_ASSET_TYPES = [
  CharacterVisualPassportAssetTypeDto.FRONT_VIEW,
  CharacterVisualPassportAssetTypeDto.SIDE_VIEW,
  CharacterVisualPassportAssetTypeDto.BACK_VIEW,
  CharacterVisualPassportAssetTypeDto.PORTRAIT,
  CharacterVisualPassportAssetTypeDto.EMOTION_SHEET,
  CharacterVisualPassportAssetTypeDto.OUTFIT_SHEET,
  CharacterVisualPassportAssetTypeDto.POSE_SHEET
] as const;

const CHARACTER_VERSION_INCLUDE = {
  character: {
    include: {
      worldBible: true
    }
  }
} satisfies Prisma.CharacterVersionInclude;

type CharacterVersionWithCharacter = Prisma.CharacterVersionGetPayload<{
  include: typeof CHARACTER_VERSION_INCLUDE;
}>;

@Injectable()
export class CharacterVisualPassportService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PromptBuilderService)
    private readonly prompts: PromptBuilderService,
    @Inject(AiProviderRegistry)
    private readonly aiProviders: AiProviderRegistry,
    @Inject(StorageService)
    private readonly storage: StorageService
  ) {}

  async generate(
    characterVersionId: string,
    dto: GenerateCharacterVisualPassportDto
  ): Promise<CharacterVisualPassportResponseDto> {
    const [characterVersion, visualStyle] = await Promise.all([
      this.getCharacterVersion(characterVersionId),
      this.getVisualStyle(dto.visualStyleId)
    ]);
    const assetTypes = dto.assetTypes && dto.assetTypes.length > 0 ? dto.assetTypes : DEFAULT_ASSET_TYPES;
    const providerId = dto.providerId ?? process.env.CHARACTER_PASSPORT_IMAGE_PROVIDER ?? 'openai';
    const model = dto.model ?? process.env.CHARACTER_PASSPORT_IMAGE_MODEL;
    const size = dto.size ?? process.env.CHARACTER_PASSPORT_IMAGE_SIZE ?? '1024x1024';
    const projectId = characterVersion.character.worldBible.projectId;
    const job = await this.prisma.generationJob.create({
      data: {
        ...(projectId === null ? {} : { projectId }),
        visualStyleId: visualStyle.id,
        status: 'PROCESSING',
        progress: 0,
        input: toInputJsonObject({
          type: 'character_visual_passport',
          characterVersionId,
          visualStyleId: visualStyle.id,
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
        const seed = createSeed(characterVersionId, assetType);
        const builtPrompt = this.prompts.buildCharacterVisualPassportPrompt({
          characterName: characterVersion.character.canonicalName,
          characterVersion,
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
            purpose: 'character-visual-passport',
            tags: ['character-version', assetType]
          }
        });
        const image = response.images[0];

        if (!image) {
          throw new Error(`Image provider "${providerId}" returned no images.`);
        }

        const imageBytes = await readGeneratedImageBytes(image);
        const mimeType = image.mimeType ?? 'image/png';
        const stored = await this.storage.putObject({
          key: buildStorageKey(characterVersionId, assetType, seed, mimeType),
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
            entityType: 'CHARACTER_VERSION',
            entityId: characterVersion.id,
            metadata: toInputJsonObject({
              passportAssetType: assetType,
              negativePrompt: builtPrompt.negativePrompt,
              visualStyleId: visualStyle.id,
              characterId: characterVersion.characterId,
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
    approvalStatus: AssetApprovalStatusDto
  ): Promise<CharacterVisualPassportAssetResponseDto> {
    const existing = await this.prisma.asset.findUnique({ where: { id: assetId } });

    if (!existing) {
      throw new NotFoundException('Asset was not found.');
    }

    const asset = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        approvalStatus: toPrismaApprovalStatus(approvalStatus),
        type: approvalStatus === AssetApprovalStatusDto.APPROVED ? 'REFERENCE' : 'GENERATED'
      }
    });

    return toAssetResponseDto(asset);
  }

  private async getCharacterVersion(
    id: string
  ): Promise<CharacterVersionWithCharacter> {
    const characterVersion = await this.prisma.characterVersion.findUnique({
      where: { id },
      include: CHARACTER_VERSION_INCLUDE
    });

    if (!characterVersion) {
      throw new NotFoundException('Character version was not found.');
    }

    return characterVersion;
  }

  private async getVisualStyle(id: string): Promise<Prisma.VisualStyleGetPayload<object>> {
    const visualStyle = await this.prisma.visualStyle.findUnique({ where: { id } });

    if (!visualStyle) {
      throw new NotFoundException('Visual style was not found.');
    }

    return visualStyle;
  }
}

function createSeed(
  characterVersionId: string,
  assetType: CharacterVisualPassportAssetTypeDto
): number {
  const base = Array.from(`${characterVersionId}:${assetType}`).reduce(
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
  characterVersionId: string,
  assetType: CharacterVisualPassportAssetTypeDto,
  seed: number,
  mimeType: string
): string {
  const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';

  return [
    'character-passports',
    characterVersionId,
    `${assetType}-${String(seed)}.${extension}`
  ].join('/');
}

function toAssetResponseDto(asset: Asset): CharacterVisualPassportAssetResponseDto {
  const metadata = toRecord(asset.metadata);

  return {
    id: asset.id,
    passportAssetType: toPassportAssetType(metadata.passportAssetType),
    approvalStatus: toDtoApprovalStatus(asset.approvalStatus),
    localPath: asset.localPath,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    prompt: asset.prompt ?? '',
    negativePrompt:
      typeof metadata.negativePrompt === 'string' ? metadata.negativePrompt : null,
    seed: asset.seed,
    provider: asset.provider,
    model: asset.model
  };
}

function toPassportAssetType(value: unknown): CharacterVisualPassportAssetTypeDto {
  return Object.values(CharacterVisualPassportAssetTypeDto).includes(
    value as CharacterVisualPassportAssetTypeDto
  )
    ? (value as CharacterVisualPassportAssetTypeDto)
    : CharacterVisualPassportAssetTypeDto.PORTRAIT;
}

function toPrismaApprovalStatus(status: AssetApprovalStatusDto): 'DRAFT' | 'APPROVED' | 'REJECTED' {
  switch (status) {
    case AssetApprovalStatusDto.APPROVED:
      return 'APPROVED';
    case AssetApprovalStatusDto.REJECTED:
      return 'REJECTED';
    case AssetApprovalStatusDto.DRAFT:
      return 'DRAFT';
  }
}

function toDtoApprovalStatus(status: string): AssetApprovalStatusDto {
  switch (status) {
    case 'APPROVED':
      return AssetApprovalStatusDto.APPROVED;
    case 'REJECTED':
      return AssetApprovalStatusDto.REJECTED;
    default:
      return AssetApprovalStatusDto.DRAFT;
  }
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

function toRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
