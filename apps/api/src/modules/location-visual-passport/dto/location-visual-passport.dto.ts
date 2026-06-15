import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum LocationVisualPassportAssetTypeDto {
  OVERVIEW = 'overview',
  MAP = 'map',
  MAIN_ANGLE = 'main_angle',
  SECONDARY_ANGLE = 'secondary_angle',
  OBJECT_DETAIL = 'object_detail',
  PALETTE_BOARD = 'palette_board'
}

export enum LocationAssetApprovalStatusDto {
  DRAFT = 'draft',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export class GenerateLocationVisualPassportDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  public readonly visualStyleId!: string;

  @ApiPropertyOptional({ enum: LocationVisualPassportAssetTypeDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsEnum(LocationVisualPassportAssetTypeDto, { each: true })
  public readonly assetTypes?: readonly LocationVisualPassportAssetTypeDto[];

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

export class PatchLocationAssetApprovalDto {
  @ApiProperty({ enum: LocationAssetApprovalStatusDto })
  @IsEnum(LocationAssetApprovalStatusDto)
  public readonly approvalStatus!: LocationAssetApprovalStatusDto;
}

export class LocationVisualPassportAssetResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty({ enum: LocationVisualPassportAssetTypeDto })
  public readonly passportAssetType!: LocationVisualPassportAssetTypeDto;

  @ApiProperty({ enum: LocationAssetApprovalStatusDto })
  public readonly approvalStatus!: LocationAssetApprovalStatusDto;

  @ApiProperty()
  public readonly localPath!: string;

  @ApiProperty()
  public readonly mimeType!: string;

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

export class LocationVisualPassportResponseDto {
  @ApiProperty()
  public readonly generationJobId!: string;

  @ApiProperty({ type: [LocationVisualPassportAssetResponseDto] })
  public readonly assets!: readonly LocationVisualPassportAssetResponseDto[];
}
