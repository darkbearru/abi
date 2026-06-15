import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequireProjectAccess } from '../../access-control/access-control.decorator.js';
import { ProjectAccessGuard } from '../../access-control/project-access.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../auth/auth.types.js';
import {
  GenerateSceneDto,
  SceneGenerationResponseDto
} from './dto/scene-generation.dto.js';
import { SceneGenerationService } from './scene-generation.service.js';

@ApiTags('scene-generation')
@Controller()
export class SceneGenerationController {
  constructor(private readonly scenes: SceneGenerationService) {}

  @Post('projects/:id/scenes/generate')
  @RequireProjectAccess('project')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Resolve scene entities and generate an illustration.' })
  @ApiOkResponse({ type: SceneGenerationResponseDto })
  generate(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Body() dto: GenerateSceneDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<SceneGenerationResponseDto> {
    return this.scenes.generate(projectId, dto, user.id);
  }
}
