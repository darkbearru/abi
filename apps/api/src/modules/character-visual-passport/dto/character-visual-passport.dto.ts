import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum CharacterVisualPassportAssetTypeDto {
  FRONT_VIEW = 'front_view',
  SIDE_VIEW = 'side_view',
  BACK_VIEW = 'back_view',
  PORTRAIT = 'portrait',
  EMOTION_SHEET = 'emotion_sheet',
  OUTFIT_SHEET = 'outfit_sheet',
  POSE_SHEET = 'pose_sheet'
}

export enum AssetApprovalStatusDto {
  DRAFT = 'draft',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export class GenerateCharacterVisualPassportDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  public readonly visualStyleId!: string;

  @ApiPropertyOptional({ enum: CharacterVisualPassportAssetTypeDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsEnum(CharacterVisualPassportAssetTypeDto, { each: true })
  public readonly assetTypes?: readonly CharacterVisualPassportAssetTypeDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public readonly providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public readonly model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public readonly size?: string;
}

export class PatchAssetApprovalDto {
  @ApiProperty({ enum: AssetApprovalStatusDto })
  @IsEnum(AssetApprovalStatusDto)
  public readonly approvalStatus!: AssetApprovalStatusDto;
}

export class CharacterVisualPassportAssetResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty({ enum: CharacterVisualPassportAssetTypeDto })
  public readonly passportAssetType!: CharacterVisualPassportAssetTypeDto;

  @ApiProperty({ enum: AssetApprovalStatusDto })
  public readonly approvalStatus!: AssetApprovalStatusDto;

  @ApiProperty()
  public readonly localPath!: string;

  @ApiProperty()
  public readonly mimeType!: string;

  @ApiPropertyOptional()
  public readonly width?: number | null;

  @ApiPropertyOptional()
  public readonly height?: number | null;

  @ApiProperty()
  public readonly prompt!: string;

  @ApiPropertyOptional()
  public readonly negativePrompt?: string | null;

  @ApiPropertyOptional()
  public readonly seed?: number | null;

  @ApiPropertyOptional()
  public readonly provider?: string | null;

  @ApiPropertyOptional()
  public readonly model?: string | null;
}

export class CharacterVisualPassportResponseDto {
  @ApiProperty()
  public readonly generationJobId!: string;

  @ApiProperty({ type: [CharacterVisualPassportAssetResponseDto] })
  public readonly assets!: readonly CharacterVisualPassportAssetResponseDto[];
}
