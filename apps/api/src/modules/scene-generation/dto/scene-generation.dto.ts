import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { ValidationResultDto } from '../../consistency-validation/dto/consistency-validation.dto.js';

export enum SceneGenerationStatusDto {
  GENERATED = 'generated',
  QUEUED = 'queued',
  NEEDS_RESOLUTION = 'needs_resolution',
  MISSING_REFERENCES = 'missing_references'
}

export class GenerateSceneDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  public readonly text!: string;

  @ApiProperty()
  @IsUUID()
  public readonly styleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  public readonly timelineHint?: string;

  @ApiPropertyOptional({ example: '16:9' })
  @IsOptional()
  @IsString()
  @IsIn(['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'])
  public readonly aspectRatio?: string;
}

export class SceneEntityCandidateDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly type!: string;

  @ApiProperty()
  public readonly name!: string;

  @ApiProperty()
  public readonly confidence!: number;

  @ApiPropertyOptional()
  public readonly matchedText?: string | null;
}

export class SceneEntityAmbiguityDto {
  @ApiProperty()
  public readonly mention!: string;

  @ApiProperty()
  public readonly entityType!: string;

  @ApiProperty({ type: [SceneEntityCandidateDto] })
  public readonly candidates!: readonly SceneEntityCandidateDto[];
}

export class SceneEntityCreateSuggestionDto {
  @ApiProperty()
  public readonly mention!: string;

  @ApiProperty()
  public readonly entityType!: string;
}

export class SceneMissingReferenceDto {
  @ApiProperty()
  public readonly entityType!: string;

  @ApiProperty()
  public readonly entityId!: string;

  @ApiPropertyOptional()
  public readonly versionId?: string | null;

  @ApiProperty()
  public readonly name!: string;

  @ApiProperty()
  public readonly reason!: string;
}

export class SceneReferenceAssetDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly entityType!: string;

  @ApiProperty()
  public readonly entityId!: string;

  @ApiProperty()
  public readonly localPath!: string;

  @ApiProperty()
  public readonly mimeType!: string;
}

export class SceneGenerationResponseDto {
  @ApiProperty({ enum: SceneGenerationStatusDto })
  public readonly status!: SceneGenerationStatusDto;

  @ApiPropertyOptional()
  public readonly sceneId?: string;

  @ApiPropertyOptional()
  public readonly generationJobId?: string;

  @ApiPropertyOptional()
  public readonly assetId?: string;

  @ApiPropertyOptional()
  public readonly localPath?: string;

  @ApiPropertyOptional()
  public readonly prompt?: string;

  @ApiPropertyOptional({ type: ValidationResultDto })
  public readonly validationResult?: ValidationResultDto;

  @ApiProperty({ type: [SceneEntityAmbiguityDto] })
  public readonly candidates!: readonly SceneEntityAmbiguityDto[];

  @ApiProperty({ type: [SceneEntityCreateSuggestionDto] })
  public readonly createSuggestions!: readonly SceneEntityCreateSuggestionDto[];

  @ApiProperty({ type: [SceneMissingReferenceDto] })
  public readonly missingReferences!: readonly SceneMissingReferenceDto[];

  @ApiProperty({ type: [SceneReferenceAssetDto] })
  public readonly referenceAssets!: readonly SceneReferenceAssetDto[];
}
