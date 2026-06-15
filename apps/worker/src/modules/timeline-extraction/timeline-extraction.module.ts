import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import {
  TIMELINE_EXTRACTION_CONFIG,
  getTimelineExtractionConfig
} from './timeline-extraction.config.js';
import { TimelineExtractionService } from './timeline-extraction.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: TIMELINE_EXTRACTION_CONFIG,
      useFactory: getTimelineExtractionConfig
    },
    TimelineExtractionService
  ],
  exports: [TimelineExtractionService]
})
export class TimelineExtractionModule {}
