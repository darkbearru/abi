import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import type { ProjectSummary } from '@abi/shared';

import { CurrentUser } from '../../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../auth/auth.types.js';
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
}
