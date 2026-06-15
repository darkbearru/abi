import {
  BookParserService,
  UnsupportedBookFormatError
} from '@abi/book-parser';
import { Injectable } from '@nestjs/common';

import { EmptyExtractedTextException, UnsupportedBookFileTypeException } from './book-upload.errors.js';
import type { UploadedBookFile } from './book-upload.types.js';

@Injectable()
export class BookTextExtractorService {
  public constructor(private readonly bookParser: BookParserService) {}

  public async extractText(file: UploadedBookFile): Promise<string> {
    try {
      const parsed = await this.bookParser.parse(file.buffer, {
        filename: file.originalname,
        mimeType: file.mimetype
      });

      if (!parsed.normalizedText) {
        throw new EmptyExtractedTextException();
      }

      return parsed.rawText;
    } catch (error) {
      if (error instanceof UnsupportedBookFormatError) {
        throw new UnsupportedBookFileTypeException();
      }

      throw error;
    }
  }
}
