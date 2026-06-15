import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequireProjectAccess } from '../../access-control/access-control.decorator.js';
import { ProjectAccessGuard } from '../../access-control/project-access.guard.js';
import { CharactersQueryService } from './characters-query.service.js';
import { CharacterResponseDto } from './dto/character.response.dto.js';
import { PatchCharacterDto } from './dto/patch-character.dto.js';

@ApiTags('characters')
@Controller()
export class CharactersController {
  constructor(private readonly charactersQuery: CharactersQueryService) {}

  @Get('projects/:id/characters')
  @RequireProjectAccess('project')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'List merged characters for a project.' })
  @ApiOkResponse({ type: [CharacterResponseDto] })
  getProjectCharacters(
    @Param('id', new ParseUUIDPipe()) projectId: string
  ): Promise<readonly CharacterResponseDto[]> {
    return this.charactersQuery.getProjectCharacters(projectId);
  }

  @Patch('characters/:id')
  @RequireProjectAccess('character')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Manually patch a merged character.' })
  @ApiOkResponse({ type: CharacterResponseDto })
  patchCharacter(
    @Param('id', new ParseUUIDPipe()) characterId: string,
    @Body() dto: PatchCharacterDto
  ): Promise<CharacterResponseDto> {
    return this.charactersQuery.patchCharacter(characterId, dto);
  }
}
