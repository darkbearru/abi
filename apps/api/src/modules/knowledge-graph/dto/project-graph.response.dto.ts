import { ApiProperty } from '@nestjs/swagger';

export class GraphNodeResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty({ type: [String] })
  public readonly labels!: readonly string[];

  @ApiProperty()
  public readonly properties!: Record<string, unknown>;
}

export class GraphRelationshipResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly type!: string;

  @ApiProperty()
  public readonly source!: string;

  @ApiProperty()
  public readonly target!: string;

  @ApiProperty()
  public readonly properties!: Record<string, unknown>;
}

export class ProjectGraphResponseDto {
  @ApiProperty({ type: [GraphNodeResponseDto] })
  public readonly nodes!: readonly GraphNodeResponseDto[];

  @ApiProperty({ type: [GraphRelationshipResponseDto] })
  public readonly relationships!: readonly GraphRelationshipResponseDto[];
}

export class SceneEntitiesResponseDto {
  @ApiProperty({ type: [String] })
  public readonly characterIds!: readonly string[];

  @ApiProperty({ type: [String] })
  public readonly locationIds!: readonly string[];

  @ApiProperty({ type: [String] })
  public readonly worldObjectIds!: readonly string[];
}
