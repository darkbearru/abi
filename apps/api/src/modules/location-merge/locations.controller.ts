import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { LocationResponseDto } from './dto/location.response.dto.js';
import { PatchLocationDto } from './dto/patch-location.dto.js';
import { LocationsQueryService } from './locations-query.service.js';

@ApiTags('locations')
@Controller()
export class LocationsController {
  constructor(private readonly locationsQuery: LocationsQueryService) {}

  @Get('projects/:id/locations')
  @ApiOperation({ summary: 'List merged locations for a project.' })
  @ApiOkResponse({ type: [LocationResponseDto] })
  getProjectLocations(@Param('id') projectId: string): Promise<readonly LocationResponseDto[]> {
    return this.locationsQuery.getProjectLocations(projectId);
  }

  @Patch('locations/:id')
  @ApiOperation({ summary: 'Manually patch a merged location.' })
  @ApiOkResponse({ type: LocationResponseDto })
  patchLocation(
    @Param('id') locationId: string,
    @Body() dto: PatchLocationDto
  ): Promise<LocationResponseDto> {
    return this.locationsQuery.patchLocation(locationId, dto);
  }
}
