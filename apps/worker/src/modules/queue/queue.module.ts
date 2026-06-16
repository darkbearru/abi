import { BookParserModule } from '@abi/book-parser';
import { StorageModule } from '@abi/storage';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { CharacterExtractionModule } from '../character-extraction/character-extraction.module.js';
import { LocationExtractionModule } from '../location-extraction/location-extraction.module.js';
import { ObjectExtractionModule } from '../object-extraction/object-extraction.module.js';
import { TimelineExtractionModule } from '../timeline-extraction/timeline-extraction.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { QUEUE_NAMES } from './queue.constants.js';
import { queueProcessors } from './queue.processors.js';

@Module({
  imports: [
    PrismaModule,
    BookParserModule,
    StorageModule.register({
      rootDir: process.env.STORAGE_ROOT ?? './storage'
    }),
    CharacterExtractionModule,
    LocationExtractionModule,
    ObjectExtractionModule,
    TimelineExtractionModule,
    BullModule.registerQueue(...QUEUE_NAMES.map((name) => ({ name })))
  ],
  providers: [...queueProcessors]
})
export class QueueModule {}
