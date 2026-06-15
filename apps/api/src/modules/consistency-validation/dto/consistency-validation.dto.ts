import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ValidationCheckTypeDto {
  CHARACTER_SIMILARITY = 'character_similarity',
  LOCATION_MATCH = 'location_match',
  OBJECT_MATCH = 'object_match',
  STYLE_MATCH = 'style_match',
  USER_REQUEST_MATCH = 'user_request_match'
}

export enum RecommendedActionDto {
  APPROVE = 'approve',
  REGENERATE = 'regenerate',
  INPAINT = 'inpaint',
  MANUAL_REVIEW = 'manual_review'
}

export class ValidationCheckDto {
  @ApiProperty({ enum: ValidationCheckTypeDto })
  public readonly type!: ValidationCheckTypeDto;

  @ApiPropertyOptional()
  public readonly entityId?: string | null;

  @ApiProperty()
  public readonly passed!: boolean;

  @ApiProperty()
  public readonly score!: number;

  @ApiProperty()
  public readonly message!: string;
}

export class ValidationResultDto {
  @ApiProperty()
  public readonly passed!: boolean;

  @ApiProperty()
  public readonly score!: number;

  @ApiProperty({ type: [ValidationCheckDto] })
  public readonly checks!: readonly ValidationCheckDto[];

  @ApiProperty({ enum: RecommendedActionDto })
  public readonly recommendedAction!: RecommendedActionDto;
}
