import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TimelineEventCharacterVersionResponseDto {
  @ApiProperty()
  public readonly characterVersionId!: string;

  @ApiProperty()
  public readonly characterId!: string;

  @ApiProperty()
  public readonly characterName!: string;

  @ApiProperty()
  public readonly version!: number;
}

export class TimelineEventResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly title!: string;

  @ApiPropertyOptional()
  public readonly description?: string | null;

  @ApiProperty()
  public readonly chapterIndex!: number;

  @ApiPropertyOptional()
  public readonly absoluteDate?: Date | null;

  @ApiProperty()
  public readonly relativeOrder!: number;

  @ApiProperty({ type: [String] })
  public readonly involvedCharacterIds!: readonly string[];

  @ApiProperty({ type: [String] })
  public readonly involvedLocationIds!: readonly string[];

  @ApiProperty({ type: [String] })
  public readonly sourceChunkIds!: readonly string[];

  @ApiProperty()
  public readonly confidence!: number;

  @ApiPropertyOptional()
  public readonly relativeMarkers?: Record<string, unknown> | null;

  @ApiProperty({ type: [TimelineEventCharacterVersionResponseDto] })
  public readonly characterVersions!: readonly TimelineEventCharacterVersionResponseDto[];
}
