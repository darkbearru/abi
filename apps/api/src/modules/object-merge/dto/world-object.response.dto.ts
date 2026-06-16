import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorldObjectResponseDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly name!: string;

  @ApiPropertyOptional()
  public readonly description?: string | null;

  @ApiPropertyOptional()
  public readonly visualPrompt?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  public readonly metadata?: unknown;
}
