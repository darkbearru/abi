import { Controller, Get, Header, Param, ParseUUIDPipe, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Asset } from '@prisma/client';

import { RequireProjectAccess } from '../../access-control/access-control.decorator.js';
import { ProjectAccessGuard } from '../../access-control/project-access.guard.js';
import { AssetsService } from './assets.service.js';

@ApiTags('assets')
@Controller()
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('projects/:id/assets')
  @RequireProjectAccess('project')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'List project assets.' })
  @ApiOkResponse({ description: 'Project assets.' })
  listProjectAssets(@Param('id', new ParseUUIDPipe()) projectId: string): Promise<readonly Asset[]> {
    return this.assets.listProjectAssets(projectId);
  }

  @Get('assets/:id/file')
  @RequireProjectAccess('asset')
  @UseGuards(ProjectAccessGuard)
  @Header('Cache-Control', 'private, max-age=300')
  @ApiOperation({ summary: 'Read an asset file.' })
  @ApiOkResponse({ description: 'Asset binary.' })
  async getAssetFile(@Param('id', new ParseUUIDPipe()) assetId: string): Promise<StreamableFile> {
    const { asset, stream } = await this.assets.getAssetFile(assetId);

    return new StreamableFile(stream, {
      type: asset.mimeType,
      disposition: `inline; filename="${asset.id}"`
    });
  }
}
