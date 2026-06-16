import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import type { ProjectSummary } from '@abi/shared';

import { CurrentUser } from '../../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../auth/auth.types.js';
import type { QueueJobResponse } from '../queue/queue.types.js';
import { UpdateProjectSettingsDto } from './dto/update-project-settings.dto.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOkResponse({ description: 'Current user projects.' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<readonly ProjectSummary[]> {
    return this.projects.listUserProjects(user.id);
  }

  @Patch(':id/settings')
  @ApiOkResponse({ description: 'Updated project settings.' })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectSettingsDto
  ): Promise<ProjectSummary> {
    return this.projects.updateSettings(user.id, id, dto);
  }

  @Post(':id/analysis/start')
  @ApiOkResponse({ description: 'Started or existing active analysis job.' })
  startAnalysis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<QueueJobResponse> {
    return this.projects.startAnalysis(user.id, id);
  }

  @Post(':id/analysis/stop')
  @ApiOkResponse({ description: 'Cancelled active analysis jobs.' })
  stopAnalysis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<readonly QueueJobResponse[]> {
    return this.projects.stopAnalysis(user.id, id);
  }
}
