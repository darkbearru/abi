import { BadRequestException } from '@nestjs/common';

export class UnsupportedBookFileTypeException extends BadRequestException {
  public constructor() {
    super('Unsupported book file type. Supported formats: PDF, EPUB, TXT, FB2.');
  }
}

export class EmptyExtractedTextException extends BadRequestException {
  public constructor() {
    super('Uploaded book does not contain extractable text.');
  }
}
