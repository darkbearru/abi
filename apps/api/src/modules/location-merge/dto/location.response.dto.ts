import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LocationAliasResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly alias!: string;
}

export class LocationVersionResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly version!: number;

  @ApiProperty()
  public readonly description!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  public readonly atmosphere?: unknown;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  public readonly palette?: unknown;

  @ApiPropertyOptional()
  public readonly era?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  public readonly socialContext?: unknown;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  public readonly lightingRules?: unknown;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  public readonly architectureRules?: unknown;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  public readonly recurringObjects?: unknown;

  @ApiProperty({ type: [String] })
  public readonly sourceFactIds!: readonly string[];
}

export class LocationResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly name!: string;

  @ApiPropertyOptional()
  public readonly parentId?: string | null;

  @ApiProperty({ type: [LocationAliasResponseDto] })
  public readonly aliases!: readonly LocationAliasResponseDto[];

  @ApiProperty({ type: [LocationVersionResponseDto] })
  public readonly versions!: readonly LocationVersionResponseDto[];
}
