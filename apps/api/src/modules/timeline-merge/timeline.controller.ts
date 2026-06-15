import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequireProjectAccess } from '../../access-control/access-control.decorator.js';
import { ProjectAccessGuard } from '../../access-control/project-access.guard.js';
import { TimelineEventResponseDto } from './dto/timeline-event.response.dto.js';
import { TimelineQueryService } from './timeline-query.service.js';

@ApiTags('timeline')
@Controller()
export class TimelineController {
  constructor(private readonly timelineQuery: TimelineQueryService) {}

  @Get('projects/:id/timeline')
  @RequireProjectAccess('project')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'List merged timeline events for a project.' })
  @ApiOkResponse({ type: [TimelineEventResponseDto] })
  getProjectTimeline(
    @Param('id', new ParseUUIDPipe()) projectId: string
  ): Promise<readonly TimelineEventResponseDto[]> {
    return this.timelineQuery.getProjectTimeline(projectId);
  }
}
