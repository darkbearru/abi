import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateProjectSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  public readonly visualStyleId?: string | null;
}
