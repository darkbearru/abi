import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CharacterAliasResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly alias!: string;
}

export class CharacterVersionResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly version!: number;

  @ApiPropertyOptional()
  public readonly age?: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  public readonly appearance!: unknown;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  public readonly personality?: unknown;

  @ApiPropertyOptional()
  public readonly speechManner?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  public readonly clothing?: unknown;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  public readonly timelineRange?: unknown;

  @ApiProperty()
  public readonly confidenceScore!: number;

  @ApiProperty({ type: [String] })
  public readonly sourceFactIds!: readonly string[];
}

export class CharacterResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly canonicalName!: string;

  @ApiProperty({ type: [CharacterAliasResponseDto] })
  public readonly aliases!: readonly CharacterAliasResponseDto[];

  @ApiProperty({ type: [CharacterVersionResponseDto] })
  public readonly versions!: readonly CharacterVersionResponseDto[];
}
