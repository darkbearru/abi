import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequireProjectAccess } from '../../access-control/access-control.decorator.js';
import { ProjectAccessGuard } from '../../access-control/project-access.guard.js';
import { LocationResponseDto } from './dto/location.response.dto.js';
import { PatchLocationDto } from './dto/patch-location.dto.js';
import { LocationsQueryService } from './locations-query.service.js';

@ApiTags('locations')
@Controller()
export class LocationsController {
  constructor(private readonly locationsQuery: LocationsQueryService) {}

  @Get('projects/:id/locations')
  @RequireProjectAccess('project')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'List merged locations for a project.' })
  @ApiOkResponse({ type: [LocationResponseDto] })
  getProjectLocations(
    @Param('id', new ParseUUIDPipe()) projectId: string
  ): Promise<readonly LocationResponseDto[]> {
    return this.locationsQuery.getProjectLocations(projectId);
  }

  @Patch('locations/:id')
  @RequireProjectAccess('location')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Manually patch a merged location.' })
  @ApiOkResponse({ type: LocationResponseDto })
  patchLocation(
    @Param('id', new ParseUUIDPipe()) locationId: string,
    @Body() dto: PatchLocationDto
  ): Promise<LocationResponseDto> {
    return this.locationsQuery.patchLocation(locationId, dto);
  }
}
