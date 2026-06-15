import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CharactersQueryService } from './characters-query.service.js';
import { CharacterResponseDto } from './dto/character.response.dto.js';
import { PatchCharacterDto } from './dto/patch-character.dto.js';

@ApiTags('characters')
@Controller()
export class CharactersController {
  constructor(private readonly charactersQuery: CharactersQueryService) {}

  @Get('projects/:id/characters')
  @ApiOperation({ summary: 'List merged characters for a project.' })
  @ApiOkResponse({ type: [CharacterResponseDto] })
  getProjectCharacters(@Param('id') projectId: string): Promise<readonly CharacterResponseDto[]> {
    return this.charactersQuery.getProjectCharacters(projectId);
  }

  @Patch('characters/:id')
  @ApiOperation({ summary: 'Manually patch a merged character.' })
  @ApiOkResponse({ type: CharacterResponseDto })
  patchCharacter(
    @Param('id') characterId: string,
    @Body() dto: PatchCharacterDto
  ): Promise<CharacterResponseDto> {
    return this.charactersQuery.patchCharacter(characterId, dto);
  }
}
