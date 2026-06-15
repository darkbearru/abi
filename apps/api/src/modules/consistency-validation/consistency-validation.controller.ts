import { Controller, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ConsistencyValidationService } from './consistency-validation.service.js';
import { ValidationResultDto } from './dto/consistency-validation.dto.js';

@ApiTags('consistency-validation')
@Controller()
export class ConsistencyValidationController {
  constructor(private readonly validation: ConsistencyValidationService) {}

  @Post('assets/:id/validate')
  @ApiOperation({ summary: 'Validate generated image consistency against scene context.' })
  @ApiOkResponse({ type: ValidationResultDto })
  validateAsset(@Param('id') assetId: string): Promise<ValidationResultDto> {
    return this.validation.validateAsset(assetId);
  }
}
