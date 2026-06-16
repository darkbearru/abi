import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { OBJECT_EXTRACTION_CONFIG, getObjectExtractionConfig } from './object-extraction.config.js';
import { ObjectExtractionService } from './object-extraction.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: OBJECT_EXTRACTION_CONFIG,
      useFactory: getObjectExtractionConfig
    },
    ObjectExtractionService
  ],
  exports: [ObjectExtractionService]
})
export class ObjectExtractionModule {}
