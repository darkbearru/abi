import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequireProjectAccess } from '../../access-control/access-control.decorator.js';
import { ProjectAccessGuard } from '../../access-control/project-access.guard.js';
import { ConsistencyValidationService } from './consistency-validation.service.js';
import { ValidationResultDto } from './dto/consistency-validation.dto.js';

@ApiTags('consistency-validation')
@Controller()
export class ConsistencyValidationController {
  constructor(private readonly validation: ConsistencyValidationService) {}

  @Post('assets/:id/validate')
  @RequireProjectAccess('asset')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Validate generated image consistency against scene context.' })
  @ApiOkResponse({ type: ValidationResultDto })
  validateAsset(
    @Param('id', new ParseUUIDPipe()) assetId: string
  ): Promise<ValidationResultDto> {
    return this.validation.validateAsset(assetId);
  }
}
