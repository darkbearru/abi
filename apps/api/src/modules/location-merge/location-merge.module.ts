import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { LocationMergeService } from './location-merge.service.js';
import { LocationsQueryService } from './locations-query.service.js';
import { LocationsController } from './locations.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [LocationsController],
  providers: [LocationMergeService, LocationsQueryService],
  exports: [LocationMergeService]
})
export class LocationMergeModule {}
