import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { TimelineEventResponseDto } from './dto/timeline-event.response.dto.js';
import { TimelineQueryService } from './timeline-query.service.js';

@ApiTags('timeline')
@Controller()
export class TimelineController {
  constructor(private readonly timelineQuery: TimelineQueryService) {}

  @Get('projects/:id/timeline')
  @ApiOperation({ summary: 'List merged timeline events for a project.' })
  @ApiOkResponse({ type: [TimelineEventResponseDto] })
  getProjectTimeline(
    @Param('id') projectId: string
  ): Promise<readonly TimelineEventResponseDto[]> {
    return this.timelineQuery.getProjectTimeline(projectId);
  }
}
