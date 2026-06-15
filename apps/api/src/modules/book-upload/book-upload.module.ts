import { BookParserModule } from '@abi/book-parser';
import { Module } from '@nestjs/common';

import { BookFileValidator } from './book-file.validator.js';
import { BookHashService } from './book-hash.service.js';
import { BookTextExtractorService } from './book-text-extractor.service.js';
import { BookUploadController } from './book-upload.controller.js';
import { BookUploadService } from './book-upload.service.js';
import { InMemoryAnalysisJobQueue } from './in-memory-analysis-job.queue.js';
import { LocalBookFileStorageService } from './local-book-file-storage.service.js';
import { AnalysisJobQueue } from './ports/analysis-job.queue.js';
import { BookUploadRepository } from './ports/book-upload.repository.js';
import { PrismaBookUploadRepository } from './prisma-book-upload.repository.js';
import { TextNormalizationService } from './text-normalization.service.js';

@Module({
  imports: [BookParserModule],
  controllers: [BookUploadController],
  providers: [
    BookFileValidator,
    BookHashService,
    BookTextExtractorService,
    BookUploadService,
    LocalBookFileStorageService,
    TextNormalizationService,
    {
      provide: BookUploadRepository,
      useClass: PrismaBookUploadRepository
    },
    {
      provide: AnalysisJobQueue,
      useClass: InMemoryAnalysisJobQueue
    }
  ]
})
export class BookUploadModule {}
