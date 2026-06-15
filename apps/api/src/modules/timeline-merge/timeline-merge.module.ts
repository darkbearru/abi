import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { TimelineController } from './timeline.controller.js';
import { TimelineMergeService } from './timeline-merge.service.js';
import { TimelineQueryService } from './timeline-query.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [TimelineController],
  providers: [TimelineMergeService, TimelineQueryService],
  exports: [TimelineMergeService, TimelineQueryService]
})
export class TimelineMergeModule {}
