import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { VectorSearchModule } from '../vector-search/vector-search.module.js';
import {
  BOOK_CHUNKING_CONFIG,
  getBookChunkingConfig
} from './book-chunking.config.js';
import { BookChunkingService } from './book-chunking.service.js';

@Module({
  imports: [PrismaModule, VectorSearchModule],
  providers: [
    {
      provide: BOOK_CHUNKING_CONFIG,
      useFactory: getBookChunkingConfig
    },
    BookChunkingService
  ],
  exports: [BookChunkingService]
})
export class BookChunkingModule {}
