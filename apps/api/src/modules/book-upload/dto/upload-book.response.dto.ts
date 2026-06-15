import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadBookResponseDto {
  @ApiProperty()
  public readonly bookId!: string;

  @ApiProperty()
  public readonly projectId!: string;

  @ApiPropertyOptional()
  public readonly bookAnalysisId?: string;

  @ApiProperty()
  public readonly existingAnalysisAvailable!: boolean;

  @ApiProperty()
  public readonly fileHash!: string;

  @ApiProperty()
  public readonly contentHash!: string;
}
