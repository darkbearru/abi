import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SemanticSearchResultDto {
  @ApiProperty()
  public readonly entityType!: string;

  @ApiProperty()
  public readonly entityId!: string;

  @ApiProperty()
  public readonly sourceEntity!: string;

  @ApiProperty()
  public readonly relevanceScore!: number;

  @ApiPropertyOptional()
  public readonly title?: string;

  @ApiProperty()
  public readonly text!: string;

  @ApiPropertyOptional()
  public readonly metadata?: Record<string, string | number | boolean | null>;
}

export class SemanticSearchResponseDto {
  @ApiProperty()
  public readonly query!: string;

  @ApiProperty({ type: [SemanticSearchResultDto] })
  public readonly results!: readonly SemanticSearchResultDto[];
}
