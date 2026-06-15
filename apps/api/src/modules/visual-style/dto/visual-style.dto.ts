import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';

const COLOR_PATTERN =
  /^(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|[a-zA-Z]+)$/;

export class CreateVisualStyleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  public readonly name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(140)
  public readonly slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public readonly description?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(3000)
  public readonly prompt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public readonly negativePrompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(COLOR_PATTERN)
  public readonly primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(COLOR_PATTERN)
  public readonly secondaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(COLOR_PATTERN)
  public readonly accentColor?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  public readonly contrastLevel?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  public readonly saturationLevel?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  public readonly grainLevel?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  public readonly lineThickness?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  public readonly isDefault?: boolean;
}

export class UpdateVisualStyleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public readonly name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(140)
  public readonly slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public readonly description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  public readonly prompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public readonly negativePrompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(COLOR_PATTERN)
  public readonly primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(COLOR_PATTERN)
  public readonly secondaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(COLOR_PATTERN)
  public readonly accentColor?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  public readonly contrastLevel?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  public readonly saturationLevel?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  public readonly grainLevel?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  public readonly lineThickness?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  public readonly isDefault?: boolean;
}

export class AbstractStyleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  public readonly input!: string;
}

export class AbstractedVisualStyleDto {
  @ApiProperty()
  public readonly sourceRequest!: string;

  @ApiProperty()
  public readonly visualLanguage!: string;

  @ApiProperty()
  public readonly prompt!: string;

  @ApiProperty()
  public readonly negativePrompt!: string;

  @ApiProperty({ type: [String] })
  public readonly avoidedReferences!: readonly string[];

  @ApiProperty()
  public readonly safetyNote!: string;

  @ApiPropertyOptional()
  public readonly primaryColor?: string;

  @ApiPropertyOptional()
  public readonly secondaryColor?: string;

  @ApiPropertyOptional()
  public readonly accentColor?: string;

  @ApiPropertyOptional()
  public readonly contrastLevel?: number;

  @ApiPropertyOptional()
  public readonly saturationLevel?: number;

  @ApiPropertyOptional()
  public readonly grainLevel?: number;

  @ApiPropertyOptional()
  public readonly lineThickness?: number;
}

export class VisualStyleResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly slug!: string;

  @ApiProperty()
  public readonly name!: string;

  @ApiPropertyOptional()
  public readonly description?: string | null;

  @ApiProperty()
  public readonly prompt!: string;

  @ApiPropertyOptional()
  public readonly negativePrompt?: string | null;

  @ApiPropertyOptional()
  public readonly primaryColor?: string | null;

  @ApiPropertyOptional()
  public readonly secondaryColor?: string | null;

  @ApiPropertyOptional()
  public readonly accentColor?: string | null;

  @ApiPropertyOptional()
  public readonly contrastLevel?: number | null;

  @ApiPropertyOptional()
  public readonly saturationLevel?: number | null;

  @ApiPropertyOptional()
  public readonly grainLevel?: number | null;

  @ApiPropertyOptional()
  public readonly lineThickness?: number | null;

  @ApiProperty()
  public readonly isDefault!: boolean;
}
