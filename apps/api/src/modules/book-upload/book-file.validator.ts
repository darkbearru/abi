import { extname } from 'node:path';

import { Injectable, PayloadTooLargeException } from '@nestjs/common';

import {
  BOOK_UPLOAD_ALLOWED_EXTENSIONS,
  BOOK_UPLOAD_ALLOWED_MIME_TYPES
} from './book-upload.constants.js';
import { getBookUploadConfig } from './book-upload.config.js';
import { UnsupportedBookFileTypeException } from './book-upload.errors.js';
import type { UploadedBookFile } from './book-upload.types.js';

@Injectable()
export class BookFileValidator {
  public validate(file: UploadedBookFile): void {
    const extension = extname(file.originalname).toLowerCase();

    if (
      !BOOK_UPLOAD_ALLOWED_EXTENSIONS.has(extension) ||
      !BOOK_UPLOAD_ALLOWED_MIME_TYPES.has(file.mimetype)
    ) {
      throw new UnsupportedBookFileTypeException();
    }

    const { maxFileSizeBytes } = getBookUploadConfig();

    if (file.size > maxFileSizeBytes) {
      throw new PayloadTooLargeException(
        `Uploaded file exceeds ${String(maxFileSizeBytes)} bytes.`
      );
    }
  }
}
