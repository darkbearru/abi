import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequireProjectAccess } from '../../access-control/access-control.decorator.js';
import { ProjectAccessGuard } from '../../access-control/project-access.guard.js';
import { WorldObjectResponseDto } from './dto/world-object.response.dto.js';
import { ObjectsQueryService } from './objects-query.service.js';

@ApiTags('objects')
@Controller()
export class ObjectsController {
  constructor(private readonly objectsQuery: ObjectsQueryService) {}

  @Get('projects/:id/objects')
  @RequireProjectAccess('project')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'List merged objects for a project.' })
  @ApiOkResponse({ type: [WorldObjectResponseDto] })
  getProjectObjects(
    @Param('id', new ParseUUIDPipe()) projectId: string
  ): Promise<readonly WorldObjectResponseDto[]> {
    return this.objectsQuery.getProjectObjects(projectId);
  }
}
