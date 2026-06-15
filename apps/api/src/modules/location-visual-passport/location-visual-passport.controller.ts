import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  GenerateLocationVisualPassportDto,
  LocationVisualPassportAssetResponseDto,
  PatchLocationAssetApprovalDto,
  LocationVisualPassportResponseDto
} from './dto/location-visual-passport.dto.js';
import { LocationVisualPassportService } from './location-visual-passport.service.js';

@ApiTags('location-visual-passports')
@Controller()
export class LocationVisualPassportController {
  constructor(private readonly passports: LocationVisualPassportService) {}

  @Post('location-versions/:id/visual-passport/generate')
  @ApiOperation({ summary: 'Generate a visual passport for a location version.' })
  @ApiOkResponse({ type: LocationVisualPassportResponseDto })
  generate(
    @Param('id') locationVersionId: string,
    @Body() dto: GenerateLocationVisualPassportDto
  ): Promise<LocationVisualPassportResponseDto> {
    return this.passports.generate(locationVersionId, dto);
  }

  @Patch('location-visual-passport-assets/:id/approval')
  @ApiOperation({ summary: 'Update generated location passport asset approval status.' })
  @ApiOkResponse({ type: LocationVisualPassportAssetResponseDto })
  updateApproval(
    @Param('id') assetId: string,
    @Body() dto: PatchLocationAssetApprovalDto
  ): Promise<LocationVisualPassportAssetResponseDto> {
    return this.passports.updateApproval(assetId, dto.approvalStatus);
  }
}
