import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadBookDto {
  @ApiPropertyOptional({
    description: 'Optional title override. Defaults to the uploaded filename.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  public readonly title?: string;

  @ApiPropertyOptional({
    description: 'Optional book author.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  public readonly author?: string;

  @ApiPropertyOptional({
    description: 'Optional book series title. Creates or reuses a user-owned series.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  public readonly seriesTitle?: string;

  @ApiPropertyOptional({
    description: 'Optional ISO-like language hint, for example "en" or "ru".'
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  public readonly language?: string;
}
