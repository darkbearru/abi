import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import {
  CHARACTER_EXTRACTION_CONFIG,
  getCharacterExtractionConfig
} from './character-extraction.config.js';
import { CharacterExtractionService } from './character-extraction.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: CHARACTER_EXTRACTION_CONFIG,
      useFactory: getCharacterExtractionConfig
    },
    CharacterExtractionService
  ],
  exports: [CharacterExtractionService]
})
export class CharacterExtractionModule {}
