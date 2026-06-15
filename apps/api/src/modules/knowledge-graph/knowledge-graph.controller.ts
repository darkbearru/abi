import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ProjectGraphResponseDto } from './dto/project-graph.response.dto.js';
import { GraphQueryService } from './graph-query.service.js';
import { GraphSyncService } from './graph-sync.service.js';

@ApiTags('knowledge-graph')
@Controller()
export class KnowledgeGraphController {
  constructor(
    private readonly graphSync: GraphSyncService,
    private readonly graphQuery: GraphQueryService
  ) {}

  @Get('projects/:id/graph')
  @ApiOperation({ summary: 'Synchronize and read a project knowledge graph.' })
  @ApiOkResponse({ type: ProjectGraphResponseDto })
  async getProjectGraph(@Param('id') projectId: string): Promise<ProjectGraphResponseDto> {
    await this.graphSync.syncProject(projectId);

    return this.graphQuery.getProjectGraph(projectId);
  }
}
