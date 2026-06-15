import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequireProjectAccess } from '../../access-control/access-control.decorator.js';
import { ProjectAccessGuard } from '../../access-control/project-access.guard.js';
import { QueueService } from './queue.service.js';
import type { QueueJobResponse } from './queue.types.js';

@ApiTags('jobs')
@Controller()
export class JobsController {
  constructor(private readonly queueService: QueueService) {}

  @Get('jobs/:id')
  @RequireProjectAccess('job')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Get job status by id.' })
  @ApiOkResponse({ description: 'Job status.' })
  getJob(@Param('id', new ParseUUIDPipe()) id: string): Promise<QueueJobResponse> {
    return this.queueService.getJob(id);
  }

  @Get('projects/:id/jobs')
  @RequireProjectAccess('project')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Get project jobs.' })
  @ApiOkResponse({ description: 'Project jobs.' })
  getProjectJobs(
    @Param('id', new ParseUUIDPipe()) id: string
  ): Promise<readonly QueueJobResponse[]> {
    return this.queueService.getProjectJobs(id);
  }
}
