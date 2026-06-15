import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class PatchCharacterVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public readonly age?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  public readonly appearance?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  public readonly personality?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public readonly speechManner?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  public readonly clothing?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  public readonly timelineRange?: Record<string, unknown>;
}

export class PatchCharacterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  public readonly canonicalName?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  public readonly aliases?: readonly string[];

  @ApiPropertyOptional({ type: PatchCharacterVersionDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PatchCharacterVersionDto)
  public readonly latestVersion?: PatchCharacterVersionDto;
}
