import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CharacterVisualPassportService } from './character-visual-passport.service.js';
import {
  CharacterVisualPassportAssetResponseDto,
  CharacterVisualPassportResponseDto,
  GenerateCharacterVisualPassportDto,
  PatchAssetApprovalDto
} from './dto/character-visual-passport.dto.js';

@ApiTags('character-visual-passports')
@Controller()
export class CharacterVisualPassportController {
  constructor(private readonly passports: CharacterVisualPassportService) {}

  @Post('character-versions/:id/visual-passport/generate')
  @ApiOperation({ summary: 'Generate a visual passport for a character version.' })
  @ApiOkResponse({ type: CharacterVisualPassportResponseDto })
  generate(
    @Param('id') characterVersionId: string,
    @Body() dto: GenerateCharacterVisualPassportDto
  ): Promise<CharacterVisualPassportResponseDto> {
    return this.passports.generate(characterVersionId, dto);
  }

  @Patch('assets/:id/approval')
  @ApiOperation({ summary: 'Update generated asset approval status.' })
  @ApiOkResponse({ type: CharacterVisualPassportAssetResponseDto })
  updateApproval(
    @Param('id') assetId: string,
    @Body() dto: PatchAssetApprovalDto
  ): Promise<CharacterVisualPassportAssetResponseDto> {
    return this.passports.updateApproval(assetId, dto.approvalStatus);
  }
}
