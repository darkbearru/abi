import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { SemanticSearchResponseDto } from './dto/search.response.dto.js';
import { VectorSearchService } from './vector-search.service.js';

@ApiTags('vector-search')
@Controller()
export class VectorSearchController {
  constructor(private readonly search: VectorSearchService) {}

  @Get('projects/:id/search')
  @ApiOperation({ summary: 'Run semantic search over project knowledge vectors.' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ type: SemanticSearchResponseDto })
  searchProject(
    @Param('id') projectId: string,
    @Query('q') query: string,
    @Query('limit') limit?: string
  ): Promise<SemanticSearchResponseDto> {
    return this.search.searchProject(projectId, query, parseLimit(limit));
  }
}

function parseLimit(value: string | undefined): number {
  return value === undefined ? 10 : Number.parseInt(value, 10);
}
