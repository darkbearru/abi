import { Module } from '@nestjs/common';

import { BookParserService } from './book-parser.service.js';

@Module({
  providers: [BookParserService],
  exports: [BookParserService]
})
export class BookParserModule {}
