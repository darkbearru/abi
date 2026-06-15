import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import {
  LOCATION_EXTRACTION_CONFIG,
  getLocationExtractionConfig
} from './location-extraction.config.js';
import { LocationExtractionService } from './location-extraction.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: LOCATION_EXTRACTION_CONFIG,
      useFactory: getLocationExtractionConfig
    },
    LocationExtractionService
  ],
  exports: [LocationExtractionService]
})
export class LocationExtractionModule {}
