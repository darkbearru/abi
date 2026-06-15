import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { RequireProjectAccess } from '../../access-control/access-control.decorator.js';
import { ProjectAccessGuard } from '../../access-control/project-access.guard.js';
import { SemanticSearchResponseDto } from './dto/search.response.dto.js';
import { VectorSearchService } from './vector-search.service.js';

@ApiTags('vector-search')
@Controller()
export class VectorSearchController {
  constructor(private readonly search: VectorSearchService) {}

  @Get('projects/:id/search')
  @RequireProjectAccess('project')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Run semantic search over project knowledge vectors.' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ type: SemanticSearchResponseDto })
  searchProject(
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Query('q') query: string,
    @Query('limit') limit?: string
  ): Promise<SemanticSearchResponseDto> {
    return this.search.searchProject(projectId, query, parseLimit(limit));
  }
}

function parseLimit(value: string | undefined): number {
  if (value === undefined) {
    return 10;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 10;
  }

  return Math.min(Math.max(parsed, 1), 50);
}
