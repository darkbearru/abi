import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

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
  @ApiOperation({ summary: 'Resolve scene entities and generate an illustration.' })
  @ApiOkResponse({ type: SceneGenerationResponseDto })
  generate(
    @Param('id') projectId: string,
    @Body() dto: GenerateSceneDto
  ): Promise<SceneGenerationResponseDto> {
    return this.scenes.generate(projectId, dto);
  }
}
